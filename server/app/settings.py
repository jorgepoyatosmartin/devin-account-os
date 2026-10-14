import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    username: str
    password_hash: str
    jwt_secret: str
    cors_origins: list[str]
    lusha_api_key: str
    lusha_daily_cap: int
    openai_api_key: str
    openai_model: str
    data_dir: Path


def _default_data_dir() -> Path:
    shared = Path("/data")
    if shared.is_dir() and os.access(shared, os.W_OK):
        return shared
    return Path("./data")


def get_settings() -> Settings:
    return Settings(
        username=os.getenv("APP_USERNAME", ""),
        password_hash=os.getenv("APP_PASSWORD_HASH", ""),
        jwt_secret=os.getenv("APP_JWT_SECRET", ""),
        cors_origins=[
            origin.strip()
            for origin in os.getenv(
                "APP_CORS_ORIGINS",
                "https://dist-huwjzpzk.devinapps.com,http://localhost:5173,http://localhost:4173",
            ).split(",")
            if origin.strip()
        ],
        lusha_api_key=os.getenv("LUSHA_API_KEY", ""),
        lusha_daily_cap=max(0, int(os.getenv("LUSHA_DAILY_CAP", "25"))),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        data_dir=Path(os.getenv("DATA_DIR") or _default_data_dir()),
    )
