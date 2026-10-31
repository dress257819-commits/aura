"""Auth session helpers — httpOnly cookie sessions backed by the `sessions` collection."""

import os
from datetime import timedelta

from fastapi import HTTPException, Request, Response
from pymongo import ASCENDING

from lib.db import db
from models.models import User, utcnow

SESSION_COOKIE = "mosaic_session"
SESSION_TTL = timedelta(days=30)


def cookie_secure() -> bool:
    # Behind the preview ingress the cookie still rides same-origin http(s); lax + host-only is fine.
    return os.environ.get("COOKIE_SECURE", "").lower() == "true"


async def create_session(response: Response, user_id: str) -> None:
    import uuid

    token = str(uuid.uuid4())
    await db.sessions.insert_one(
        {"token": token, "user_id": user_id, "created_at": utcnow()}
    )
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=cookie_secure(),
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )


async def destroy_session(response: Response, token: str) -> None:
    await db.sessions.delete_one({"token": token})
    response.delete_cookie(key=SESSION_COOKIE, path="/")


async def get_current_user(request: Request) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")
    doc = await db.users.find_one({"id": session["user_id"]})
    if not doc:
        raise HTTPException(status_code=401, detail="Account not found")
    return User(**doc)


async def get_optional_user(request: Request) -> User | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    session = await db.sessions.find_one({"token": token})
    if not session:
        return None
    doc = await db.users.find_one({"id": session["user_id"]})
    return User(**doc) if doc else None


# keep the import referenced (sessions query sorts would use it in aggregates)
_ = ASCENDING
