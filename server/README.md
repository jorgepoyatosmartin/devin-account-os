# Pipeline OS API

Requires Python 3.11. From this directory:

```sh
poetry install
poetry run uvicorn app.main:app --reload
```

Set `APP_USERNAME`, `APP_PASSWORD_HASH`, and `APP_JWT_SECRET` before starting the API. Create a bcrypt password hash with:

```sh
poetry run python scripts/hash_password.py
```

The script reads from stdin or prompts without echo. Set `DATA_DIR` for persistent SQLite storage; by default the API uses writable `/data`, otherwise `./data`.

Run the mocked backend tests with `poetry run pytest -q`. The tests use a temporary database and never contact provider APIs.

Build the frontend with `VITE_API_URL=https://your-api.example npm run build`. Leaving it unset keeps the app local-only and hides server features.

See `.env.example` for supported environment variable names. Never commit `.env`, credentials, or real contact and compensation data.
