import bcrypt
import pytest
from fastapi.testclient import TestClient

from app.main import app, failed_logins


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("APP_USERNAME", "test-user")
    monkeypatch.setenv("APP_PASSWORD_HASH", bcrypt.hashpw(b"throwaway", bcrypt.gensalt()).decode())
    monkeypatch.setenv("APP_JWT_SECRET", "test-secret-only")
    monkeypatch.setenv("LUSHA_API_KEY", "lusha-test-key")
    monkeypatch.setenv("LUSHA_DAILY_CAP", "25")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-test-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4.1-mini")
    failed_logins.clear()
    with TestClient(app) as test_client:
        yield test_client
    failed_logins.clear()


@pytest.fixture
def auth(client):
    response = client.post("/auth/login", json={"username": "test-user", "password": "throwaway"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}
