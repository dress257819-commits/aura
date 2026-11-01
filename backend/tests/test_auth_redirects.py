from routers.auth import (
    _google_frontend_url,
    _google_redirect,
    _google_redirect_uri,
    google_start,
)


def test_google_frontend_redirect_uses_render_domain_in_production(monkeypatch):
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://aura-mox9.onrender.com/")
    monkeypatch.setenv("GOOGLE_FRONTEND_URL", "http://localhost:3000/auth")

    response = _google_redirect("not_configured")

    assert response.headers["location"] == (
        "https://aura-mox9.onrender.com/auth?google=not_configured"
    )


def test_google_callback_uri_uses_render_domain_in_production(monkeypatch):
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://aura-mox9.onrender.com/")
    monkeypatch.setenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8001/api/auth/google/callback",
    )

    assert _google_redirect_uri() == (
        "https://aura-mox9.onrender.com/api/auth/google/callback"
    )


def test_google_urls_keep_local_defaults_without_render(monkeypatch):
    monkeypatch.delenv("RENDER_EXTERNAL_URL", raising=False)
    monkeypatch.delenv("GOOGLE_FRONTEND_URL", raising=False)
    monkeypatch.delenv("GOOGLE_REDIRECT_URI", raising=False)

    assert _google_frontend_url() == "http://localhost:3000/auth"
    assert _google_redirect_uri() == "http://localhost:8001/api/auth/google/callback"


async def test_unconfigured_google_sign_in_returns_to_render_domain(monkeypatch):
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://aura-mox9.onrender.com")
    monkeypatch.setenv("GOOGLE_FRONTEND_URL", "http://localhost:3000/auth")
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_REDIRECT_URI", raising=False)

    response = await google_start()

    assert response.headers["location"] == (
        "https://aura-mox9.onrender.com/auth?google=not_configured"
    )
