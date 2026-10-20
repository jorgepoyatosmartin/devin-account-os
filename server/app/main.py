import json
import re
import secrets
import time
from collections import defaultdict, deque
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3
from typing import Any, Iterator, Literal

import bcrypt
import httpx
import jwt
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.database import connect, encode_json
from app.settings import get_settings

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
bearer = HTTPBearer(auto_error=False)
failed_logins: dict[str, deque[float]] = defaultdict(deque)
STATE_KEY = re.compile(r"^(?:cognition-pipeline-[a-z0-9-]+|power-chart:[a-z0-9-]+)$")
EXCLUDED_KEYS = {
    "cognition-pipeline-auth",
    "cognition-pipeline-api-url",
    "cognition-pipeline-sync-versions",
}
MAX_STATE_BYTES = 2 * 1024 * 1024
PROMPTS = Path(__file__).parent / "prompts"


class LoginInput(BaseModel):
    username: str
    password: str


class StateInput(BaseModel):
    value: Any
    baseVersion: int = Field(ge=0)


class StateDeleteInput(BaseModel):
    baseVersion: int = Field(ge=0)


class LushaInput(BaseModel):
    accountId: str
    firstName: str | None = None
    lastName: str | None = None
    companyName: str | None = None
    companyDomain: str | None = None
    email: str | None = None
    linkedinUrl: str | None = None


class DraftMessageInput(BaseModel):
    hypothesis: dict[str, str]
    person: dict[str, str | None]
    channel: Literal["email", "linkedin", "call"]
    language: str | None = None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def timestamp(value: datetime | None = None) -> str:
    return (value or now_utc()).isoformat()


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    connection = connect(get_settings().data_dir)
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def state_item(row: Any) -> dict[str, Any]:
    return {
        "key": row["key"],
        "value": json.loads(row["value"]),
        "version": row["version"],
        "updatedAt": row["updated_at"],
    }


def validate_state_key(key: str) -> None:
    if not STATE_KEY.fullmatch(key) or key in EXCLUDED_KEYS:
        raise HTTPException(status_code=400, detail={"error": "invalid_key"})


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    settings = get_settings()
    if credentials is None or not settings.jwt_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        username = payload.get("sub")
        if not isinstance(username, str):
            raise ValueError
        return username
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=401, detail="Unauthorized") from None


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(HTTPException)
async def json_http_error(_: Request, exc: HTTPException):
    content = exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail}
    return JSONResponse(status_code=exc.status_code, content=content, headers=exc.headers)


@app.get("/health")
def health():
    settings = get_settings()
    return {
        "status": "ok",
        "features": {"lusha": bool(settings.lusha_api_key), "openai": bool(settings.openai_api_key)},
        "dataDir": str(settings.data_dir),
    }


@app.post("/auth/login")
def login(body: LoginInput, request: Request):
    settings = get_settings()
    client_ip = request.client.host if request.client else "unknown"
    attempts = failed_logins[client_ip]
    now = time.monotonic()
    while attempts and now - attempts[0] >= 300:
        attempts.popleft()
    if len(attempts) >= 5:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"})
    username_matches = secrets.compare_digest(body.username, settings.username)
    try:
        password_matches = bool(settings.password_hash) and bcrypt.checkpw(
            body.password.encode(), settings.password_hash.encode()
        )
    except ValueError:
        password_matches = False
    if not (username_matches and password_matches and settings.jwt_secret):
        attempts.append(now)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    attempts.clear()
    expires = now_utc() + timedelta(hours=12)
    token = jwt.encode({"sub": settings.username, "exp": expires}, settings.jwt_secret, algorithm="HS256")
    return {"token": token, "expiresAt": timestamp(expires)}


@app.get("/auth/me")
def me(username: str = Depends(current_user)):
    return {"username": username}


@app.get("/state")
def get_state(_: str = Depends(current_user)):
    with db() as connection:
        rows = connection.execute("SELECT * FROM state ORDER BY key").fetchall()
    return {"items": [state_item(row) for row in rows]}


@app.put("/state/{key}")
def put_state(key: str, body: StateInput, _: str = Depends(current_user)):
    validate_state_key(key)
    serialized = encode_json(body.value)
    if len(serialized.encode("utf-8")) > MAX_STATE_BYTES:
        raise HTTPException(status_code=413, detail={"error": "value_too_large"})
    with db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute("SELECT * FROM state WHERE key = ?", (key,)).fetchone()
        if row and row["version"] != body.baseVersion:
            raise HTTPException(status_code=409, detail={"current": state_item(row)})
        version = (row["version"] if row else 0) + 1
        updated_at = timestamp()
        connection.execute(
            "INSERT INTO state(key, value, version, updated_at) VALUES(?,?,?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, version=excluded.version, updated_at=excluded.updated_at",
            (key, serialized, version, updated_at),
        )
        saved = connection.execute("SELECT * FROM state WHERE key = ?", (key,)).fetchone()
    return state_item(saved)


@app.delete("/state/{key}")
def delete_state(key: str, body: StateDeleteInput, _: str = Depends(current_user)):
    validate_state_key(key)
    with db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute("SELECT * FROM state WHERE key = ?", (key,)).fetchone()
        if row and row["version"] != body.baseVersion:
            raise HTTPException(status_code=409, detail={"current": state_item(row)})
        connection.execute("DELETE FROM state WHERE key = ?", (key,))
    return {"deleted": True}


def normalize_query(body: LushaInput) -> tuple[str, dict[str, str]]:
    params = {
        key: value.strip()
        for key, value in body.model_dump(exclude={"accountId"}, exclude_none=True).items()
        if value and value.strip()
    }
    normalized = {}
    for key, value in params.items():
        if key == "linkedinUrl":
            value = re.sub(r"^https?://", "", value.casefold().strip())
            value = re.sub(r"^www\.", "", value)
            value = value.split("?", 1)[0].rstrip("/")
        normalized[key] = value.casefold().strip()
    return json.dumps(normalized, sort_keys=True, separators=(",", ":")), params


def _map_lusha_person(payload: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    record = payload.get("data") or payload.get("person") or payload
    if isinstance(record, list):
        record = record[0] if record else {}
    if not isinstance(record, dict):
        return None
    company = record.get("company") if isinstance(record.get("company"), dict) else {}
    location = record.get("location") if isinstance(record.get("location"), dict) else {}
    emails = record.get("emailAddresses") or record.get("emails") or []
    phones = record.get("phoneNumbers") or record.get("phones") or []
    first_email = emails[0] if isinstance(emails, list) and emails else emails if isinstance(emails, dict) else None
    first_phone = phones[0] if isinstance(phones, list) and phones else phones if isinstance(phones, dict) else None
    email = record.get("email") or (first_email.get("email") or first_email.get("value") if isinstance(first_email, dict) else first_email if isinstance(first_email, str) else None)
    phone = record.get("phone") or (first_phone.get("number") or first_phone.get("phoneNumber") if isinstance(first_phone, dict) else first_phone if isinstance(first_phone, str) else None)
    first = record.get("firstName") or record.get("first_name") or ""
    last = record.get("lastName") or record.get("last_name") or ""
    name = record.get("fullName") or record.get("name") or " ".join(filter(None, [first, last])) or None
    person = {
        "name": name,
        "title": record.get("jobTitle") or record.get("title") or record.get("job_title"),
        "company": company.get("name") or record.get("companyName") or record.get("company_name"),
        "email": email,
        "phone": phone,
        "linkedinUrl": record.get("linkedinUrl") or record.get("linkedin_url"),
        "country": location.get("country") or record.get("country"),
    }
    return person if any(person.values()) else None


def lusha_calls_today(connection: Any) -> int:
    row = connection.execute("SELECT count FROM lusha_calls WHERE day = ?", (now_utc().date().isoformat(),)).fetchone()
    return row["count"] if row else 0


@app.post("/lusha/person")
async def lusha_person(body: LushaInput, _: str = Depends(current_user)):
    settings = get_settings()
    if not settings.lusha_api_key:
        raise HTTPException(status_code=503, detail={"error": "lusha_unavailable"})
    valid = bool(
        (body.email and body.email.strip())
        or (body.linkedinUrl and body.linkedinUrl.strip())
        or (
            body.firstName and body.firstName.strip()
            and body.lastName and body.lastName.strip()
            and ((body.companyName and body.companyName.strip()) or (body.companyDomain and body.companyDomain.strip()))
        )
    )
    if not valid:
        raise HTTPException(status_code=400, detail={"error": "insufficient_person_data"})
    cache_key, params = normalize_query(body)
    with db() as connection:
        connection.execute("BEGIN IMMEDIATE")
        cached = connection.execute(
            "SELECT response FROM lusha_cache WHERE cache_key = ? AND expires_at > ?",
            (cache_key, timestamp()),
        ).fetchone()
        if cached:
            mapped = json.loads(cached["response"])
            return {"found": mapped is not None, "person": mapped, "cached": True, "creditsUsedToday": lusha_calls_today(connection), "dailyCap": settings.lusha_daily_cap}
        credits = lusha_calls_today(connection)
        if credits >= settings.lusha_daily_cap:
            raise HTTPException(status_code=429, detail={"error": "daily_cap"})
        today = now_utc().date().isoformat()
        connection.execute(
            "INSERT INTO lusha_calls(day,count) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1",
            (today,),
        )
        credits = lusha_calls_today(connection)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                "https://api.lusha.com/v2/person",
                headers={"api_key": settings.lusha_api_key},
                params=params,
            )
        response.raise_for_status()
        mapped = _map_lusha_person(response.json())
    except (httpx.HTTPError, ValueError):
        raise HTTPException(status_code=502, detail={"error": "lusha_upstream_error"}) from None
    with db() as connection:
        connection.execute(
            "INSERT OR REPLACE INTO lusha_cache(cache_key, response, expires_at) VALUES(?,?,?)",
            (cache_key, encode_json(mapped), timestamp(now_utc() + timedelta(days=30))),
        )
    return {"found": mapped is not None, "person": mapped, "cached": False, "creditsUsedToday": credits, "dailyCap": settings.lusha_daily_cap}


SIGNAL_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["products", "salesPlayId", "relevance", "rationale", "hypothesis", "nextBestAction", "assumptions"],
    "properties": {
        "products": {"type": "array", "items": {"type": "string"}},
        "salesPlayId": {"type": ["string", "null"]},
        "relevance": {"type": "integer"},
        "rationale": {"type": "string"},
        "hypothesis": {"type": "object", "additionalProperties": False, "required": ["whyChange", "whyNow", "whyUs"], "properties": {key: {"type": "string"} for key in ("whyChange", "whyNow", "whyUs")}},
        "nextBestAction": {"type": "object", "additionalProperties": False, "required": ["stakeholderId", "action"], "properties": {"stakeholderId": {"type": ["string", "null"]}, "action": {"type": "string"}}},
        "assumptions": {"type": "array", "items": {"type": "string"}},
    },
}
DRAFT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["subject", "body"],
    "properties": {"subject": {"type": "string"}, "body": {"type": "string"}},
}


def output_text(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                return content.get("text", "")
    raise ValueError("Missing output text")


async def responses_api(prompt_file: str, payload: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail={"error": "openai_unavailable"})
    body = {
        "model": settings.openai_model,
        "instructions": (PROMPTS / prompt_file).read_text(encoding="utf-8"),
        "input": json.dumps(payload, ensure_ascii=False),
        "text": {"format": {"type": "json_schema", "name": "pipeline_output", "strict": True, "schema": schema}},
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=body,
            )
        response.raise_for_status()
        return json.loads(output_text(response.json()))
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=502, detail={"error": "openai_upstream_error"}) from None


@app.post("/llm/signal-analysis")
async def analyze_signal(payload: dict[str, Any], _: str = Depends(current_user)):
    result = await responses_api("signal_analysis.md", payload, SIGNAL_SCHEMA)
    catalog = payload.get("catalog", {})
    products = {item.get("id") for item in catalog.get("products", [])}
    plays = {item.get("id") for item in catalog.get("salesPlays", [])}
    stakeholders = {item.get("id") for item in payload.get("stakeholders", [])}
    result["products"] = [item for item in result.get("products", []) if item in products]
    if result.get("salesPlayId") not in plays:
        result["salesPlayId"] = None
    if result.get("nextBestAction", {}).get("stakeholderId") not in stakeholders:
        result["nextBestAction"]["stakeholderId"] = None
    return result


@app.post("/llm/draft-message")
async def draft_message(payload: DraftMessageInput, _: str = Depends(current_user)):
    result = await responses_api("draft_message.md", payload.model_dump(exclude_none=True), DRAFT_SCHEMA)
    return {**result, "status": "draft"}
