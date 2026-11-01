"""Auth — signup / login / logout / me. Sessions are httpOnly cookies."""

import logging
import os
import re
import secrets
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from passlib.context import CryptContext
from starlette.responses import RedirectResponse

from lib.plans import effective_plan
from lib.session import (
    cookie_secure,
    create_session,
    destroy_session,
    get_current_user,
)
from lib.db import db
from models.models import LoginCreate, MeProfile, SignupCreate, User

router = APIRouter(prefix="/auth")
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

RESERVED_USERNAMES = {
    "dashboard", "auth", "login", "signup", "u", "api", "explore", "leaderboard", "pricing",
    "assets", "static", "mosaic", "admin", "settings", "profile",
}
USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")
GOOGLE_STATE_COOKIE = "aura_google_oauth_state"
GOOGLE_STATE_TTL = 600
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _is_local_url(url: str) -> bool:
    return urlsplit(url).hostname in {"localhost", "127.0.0.1", "::1"}


def _google_frontend_url() -> str:
    configured_url = os.environ.get("GOOGLE_FRONTEND_URL")
    render_url = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")
    if render_url and (not configured_url or _is_local_url(configured_url)):
        return f"{render_url}/auth"
    return configured_url or "http://localhost:3000/auth"


def _google_redirect_uri() -> str:
    configured_uri = os.environ.get("GOOGLE_REDIRECT_URI")
    render_url = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")
    if render_url and (not configured_uri or _is_local_url(configured_uri)):
        return f"{render_url}/api/auth/google/callback"
    return configured_uri or "http://localhost:8001/api/auth/google/callback"


def _google_redirect(status: str) -> RedirectResponse:
    frontend_url = _google_frontend_url()
    separator = "&" if "?" in frontend_url else "?"
    return RedirectResponse(f"{frontend_url}{separator}{urlencode({'google': status})}", status_code=303)


def _google_state_cookie(response: RedirectResponse) -> None:
    response.set_cookie(
        key=GOOGLE_STATE_COOKIE,
        value="",
        httponly=True,
        samesite="lax",
        secure=cookie_secure(),
        max_age=0,
        path="/api/auth/google",
    )


async def _available_google_username(email: str) -> str:
    candidate = re.sub(r"[^a-z0-9_]", "_", email.partition("@")[0].lower()).strip("_")
    candidate = candidate[:24]
    if len(candidate) < 3 or candidate in RESERVED_USERNAMES:
        candidate = "creator"

    suffix = 0
    while True:
        tail = str(suffix) if suffix else ""
        username = f"{candidate[:24 - len(tail)]}{tail}"
        if not await db.users.find_one({"username": username}, {"_id": 1}):
            return username
        suffix += 1


def me_response(user: User) -> MeProfile:
    return MeProfile(
        id=user.id, email=user.email, username=user.username, name=user.name,
        bio=user.bio, location=user.location, avatar_url=user.avatar_url,
        cover_url=user.cover_url, interests=user.interests,
        daily_question=user.daily_question, music=user.music,
        appearance=user.appearance, chatbot=user.chatbot,
        plan=effective_plan(user.model_dump()),
        leaderboard_visible=user.leaderboard_visible, created_at=user.created_at,
    )


@router.post("/signup", response_model=MeProfile)
async def signup(input: SignupCreate, response: Response):
    email = input.email.strip().lower()
    username = input.username.strip().lower()

    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if len(input.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if not USERNAME_RE.match(username):
        raise HTTPException(
            status_code=422,
            detail="Username must be 3-24 characters: lowercase letters, numbers or underscores",
        )
    if username in RESERVED_USERNAMES:
        raise HTTPException(status_code=422, detail="That username is reserved")

    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=409, detail="That username is taken")

    user = User(
        email=email,
        password_hash=pwd_context.hash(input.password),
        username=username,
        name=input.name.strip() or username,
    )
    await db.users.insert_one(user.model_dump())
    await create_session(response, user.id)
    return me_response(user)


@router.post("/login", response_model=MeProfile)
async def login(input: LoginCreate, response: Response):
    email = input.email.strip().lower()
    doc = await db.users.find_one({"email": email})
    if (
        not doc
        or not doc.get("password_hash")
        or not pwd_context.verify(input.password, doc["password_hash"])
    ):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    user = User(**doc)
    await create_session(response, user.id)
    return me_response(user)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    token = request.cookies.get("mosaic_session")
    if token:
        await destroy_session(response, token)
    return None


@router.get("/me", response_model=MeProfile)
async def me(user: User = Depends(get_current_user)):
    return me_response(user)


@router.get("/google/start", include_in_schema=False)
async def google_start():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    redirect_uri = _google_redirect_uri()
    if not client_id or not redirect_uri:
        logger.error("Google sign-in is unavailable: GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI is missing")
        return _google_redirect("not_configured")

    state = secrets.token_urlsafe(32)
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    })
    response = RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}", status_code=302)
    response.set_cookie(
        key=GOOGLE_STATE_COOKIE,
        value=state,
        httponly=True,
        samesite="lax",
        secure=cookie_secure(),
        max_age=GOOGLE_STATE_TTL,
        path="/api/auth/google",
    )
    return response


@router.get("/google/callback", include_in_schema=False)
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    state_cookie = request.cookies.get(GOOGLE_STATE_COOKIE)
    if not state or not state_cookie or not secrets.compare_digest(state, state_cookie):
        response = _google_redirect("invalid_state")
        _google_state_cookie(response)
        return response
    if error or not code:
        response = _google_redirect("cancelled")
        _google_state_cookie(response)
        return response

    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    redirect_uri = _google_redirect_uri()
    if not client_id or not client_secret or not redirect_uri:
        logger.error("Google sign-in callback received without complete OAuth configuration")
        response = _google_redirect("not_configured")
        _google_state_cookie(response)
        return response

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as oauth_client:
            token_response = await oauth_client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_response.raise_for_status()
            access_token = token_response.json().get("access_token")
            if not isinstance(access_token, str) or not access_token:
                logger.error("Google OAuth token response did not contain an access token")
                response = _google_redirect("failed")
                _google_state_cookie(response)
                return response

            userinfo_response = await oauth_client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            userinfo_response.raise_for_status()
            google_user = userinfo_response.json()
    except (httpx.HTTPError, ValueError):
        logger.exception("Google OAuth verification failed")
        response = _google_redirect("failed")
        _google_state_cookie(response)
        return response

    google_sub = google_user.get("sub")
    email = google_user.get("email")
    if (
        not isinstance(google_sub, str)
        or not google_sub
        or not isinstance(email, str)
        or "@" not in email
        or google_user.get("email_verified") is not True
    ):
        response = _google_redirect("unverified_email")
        _google_state_cookie(response)
        return response
    email = email.strip().lower()

    user_doc = await db.users.find_one({"google_sub": google_sub})
    if not user_doc:
        user_doc = await db.users.find_one({"email": email})
        if user_doc and user_doc.get("google_sub") not in (None, google_sub):
            response = _google_redirect("account_conflict")
            _google_state_cookie(response)
            return response
        if user_doc:
            await db.users.update_one(
                {"id": user_doc["id"]},
                {"$set": {"google_sub": google_sub}},
            )
        else:
            username = await _available_google_username(email)
            name = google_user.get("name")
            picture = google_user.get("picture")
            user = User(
                email=email,
                username=username,
                name=name.strip() if isinstance(name, str) and name.strip() else username,
                avatar_url=picture if isinstance(picture, str) else "",
            )
            user_doc = user.model_dump()
            user_doc["google_sub"] = google_sub
            await db.users.insert_one(user_doc)

    user = User(**user_doc)
    response = _google_redirect("success")
    _google_state_cookie(response)
    await create_session(response, user.id)
    return response
