import json
from pathlib import Path

import respx
from httpx import Response


def test_login_and_me(client, auth):
    assert client.get("/auth/me", headers=auth).json() == {"username": "test-user"}
    assert client.get("/health").json()["status"] == "ok"


def test_bad_login_and_rate_limit(client):
    body = {"username": "test-user", "password": "incorrect"}
    for _ in range(5):
        assert client.post("/auth/login", json=body).status_code == 401
    assert client.post("/auth/login", json=body).status_code == 429


def test_auth_required(client):
    assert client.get("/state").status_code == 401
    assert client.get("/auth/me").status_code == 401


def test_state_put_get_conflict_and_delete(client, auth):
    key = "cognition-pipeline-pg"
    saved = client.put(f"/state/{key}", headers=auth, json={"value": {"x": 1}, "baseVersion": 0})
    assert saved.status_code == 200
    item = saved.json()
    assert item["version"] == 1
    assert client.get("/state", headers=auth).json()["items"] == [item]
    conflict = client.put(f"/state/{key}", headers=auth, json={"value": {}, "baseVersion": 0})
    assert conflict.status_code == 409
    assert conflict.json()["current"] == item
    assert client.request("DELETE", f"/state/{key}", headers=auth, json={"baseVersion": 1}).status_code == 200
    assert client.get("/state", headers=auth).json()["items"] == []


def test_state_key_validation_and_size_limit(client, auth):
    for key in ("wrong", "cognition-pipeline-auth", "cognition-pipeline-api-url", "power-chart:UPPER"):
        assert client.put(f"/state/{key}", headers=auth, json={"value": 1, "baseVersion": 0}).status_code == 400
    oversized = "x" * (2 * 1024 * 1024 + 10)
    assert client.put("/state/cognition-pipeline-large", headers=auth, json={"value": oversized, "baseVersion": 0}).status_code == 413


def test_lusha_validation_cache_and_mapping(client, auth):
    fixture = {
        "data": {
            "firstName": "Ada",
            "lastName": "Lovelace",
            "jobTitle": "Director",
            "company": {"name": "Example"},
            "emailAddresses": [{"email": "ada@example.invalid"}],
            "phoneNumbers": [{"number": "+10000000000"}],
            "linkedinUrl": "https://linkedin.com/in/ada",
            "location": {"country": "GB"},
        }
    }
    with respx.mock(assert_all_called=True) as mock:
        route = mock.get("https://api.lusha.com/v2/person").mock(return_value=Response(200, json=fixture))
        assert client.post("/lusha/person", headers=auth, json={"accountId": "a"}).status_code == 400
        first = client.post("/lusha/person", headers=auth, json={"accountId": "a", "email": "ADA@example.invalid"})
        assert first.status_code == 200
        result = first.json()
        assert result["person"] == {
            "name": "Ada Lovelace",
            "title": "Director",
            "company": "Example",
            "email": "ada@example.invalid",
            "phone": "+10000000000",
            "linkedinUrl": "https://linkedin.com/in/ada",
            "country": "GB",
        }
        assert result["dailyCap"] == 25
        assert route.calls[0].request.headers["api_key"] == "lusha-test-key"
        cached = client.post("/lusha/person", headers=auth, json={"accountId": "b", "email": "ada@example.invalid"})
        assert cached.json()["cached"] is True
        assert cached.json()["creditsUsedToday"] == 1
        assert route.call_count == 1


def test_lusha_cap_and_missing_key(client, auth, monkeypatch):
    monkeypatch.setenv("LUSHA_DAILY_CAP", "1")
    with respx.mock(assert_all_called=True) as mock:
        mock.get("https://api.lusha.com/v2/person").mock(return_value=Response(200, json={"data": {}}))
        body = {"accountId": "a", "email": "first@example.invalid"}
        assert client.post("/lusha/person", headers=auth, json=body).status_code == 200
        capped = client.post("/lusha/person", headers=auth, json={"accountId": "a", "email": "second@example.invalid"})
        assert capped.status_code == 429
        assert capped.json() == {"error": "daily_cap"}
    monkeypatch.setenv("LUSHA_API_KEY", "")
    assert client.post("/lusha/person", headers=auth, json={"accountId": "a", "email": "x@example.invalid"}).status_code == 503


def test_signal_analysis_filters_ids_and_uses_prompt(client, auth):
    output = {
        "products": ["devin-cloud", "invalid"],
        "salesPlayId": "invalid",
        "relevance": 4,
        "rationale": "Grounded",
        "hypothesis": {"whyChange": "a", "whyNow": "b", "whyUs": "c"},
        "nextBestAction": {"stakeholderId": "invalid", "action": "Ask"},
        "assumptions": [],
    }
    with respx.mock(assert_all_called=True) as mock:
        route = mock.post("https://api.openai.com/v1/responses").mock(
            return_value=Response(200, json={"output_text": json.dumps(output)})
        )
        payload = {
            "signal": {"id": "s"},
            "account": {"id": "a"},
            "stakeholders": [{"id": "p1"}],
            "catalog": {"products": [{"id": "devin-cloud", "name": "Devin Cloud"}], "salesPlays": [{"id": "play", "name": "Play"}]},
        }
        result = client.post("/llm/signal-analysis", headers=auth, json=payload)
        assert result.status_code == 200
        assert result.json()["products"] == ["devin-cloud"]
        assert result.json()["salesPlayId"] is None
        assert result.json()["nextBestAction"]["stakeholderId"] is None
        sent = json.loads(route.calls[0].request.read())
        assert sent["instructions"] == Path(__file__).parents[1].joinpath("app/prompts/signal_analysis.md").read_text()


def test_llm_draft_status_and_missing_key(client, auth, monkeypatch):
    output = {"subject": "Hello", "body": "Draft"}
    with respx.mock(assert_all_called=True) as mock:
        mock.post("https://api.openai.com/v1/responses").mock(return_value=Response(200, json={"output_text": json.dumps(output)}))
        response = client.post(
            "/llm/draft-message",
            headers=auth,
            json={"hypothesis": {"whyChange": "a", "whyNow": "b", "whyUs": "c"}, "person": {"name": "Ada", "title": "Director"}, "channel": "email"},
        )
        assert response.json() == {"subject": "Hello", "body": "Draft", "status": "draft"}
    monkeypatch.setenv("OPENAI_API_KEY", "")
    assert client.post(
        "/llm/draft-message",
        headers=auth,
        json={"hypothesis": {"whyChange": "a", "whyNow": "b", "whyUs": "c"}, "person": {"name": "Ada"}, "channel": "email"},
    ).status_code == 503
