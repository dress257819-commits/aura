"""Anonymous messages — public send with spam protection, owner moderation, public Q&A."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from datetime import timedelta

from lib.db import db
from lib.session import get_current_user
from models.models import Message, MessageCounts, MessageCreate, MessageUpdate, User, utcnow

router = APIRouter()

MAX_LEN = 500
MIN_LEN = 2
RATE_WINDOW = timedelta(minutes=10)
RATE_LIMIT = 3  # messages per visitor per profile per window
SPAM_PATTERNS = ("http://", "https://", "www.", "t.me/", "bit.ly")


@router.post("/u/{username}/messages", response_model=Message, status_code=201)
async def send_message(username: str, input: MessageCreate):
    doc = await db.users.find_one({"username": username.lower()})
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")

    content = input.content.strip()
    if len(content) < MIN_LEN:
        raise HTTPException(status_code=422, detail="Message is too short")
    if len(content) > MAX_LEN:
        raise HTTPException(status_code=422, detail=f"Messages are capped at {MAX_LEN} characters")
    lowered = content.lower()
    if any(p in lowered for p in SPAM_PATTERNS):
        raise HTTPException(status_code=422, detail="Links are not allowed in messages")

    visitor_id = input.visitor_id.strip()[:64] or "anon"
    recent = await db.messages.count_documents({
        "visitor_id": visitor_id,
        "recipient_id": doc["id"],
        "created_at": {"$gte": utcnow() - RATE_WINDOW},
    })
    if recent >= RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="You've sent a few messages already — take a short break.",
        )

    msg = Message(
        recipient_id=doc["id"],
        recipient_username=doc["username"],
        content=content,
        sender_name=(input.sender_name.strip()[:30] or "Anonymous"),
        visitor_id=visitor_id,
    )
    await db.messages.insert_one(msg.model_dump())
    await db.events.insert_one(
        {"id": str(uuid.uuid4()), "user_id": doc["id"], "type": "message_received",
         "meta": {}, "created_at": utcnow()}
    )
    return msg


@router.get("/me/messages", response_model=list[Message])
async def inbox(status: str | None = None, user: User = Depends(get_current_user)):
    query: dict = {"recipient_id": user.id}
    if status in ("pending", "published", "rejected"):
        query["status"] = status
    docs = await db.messages.find(query).sort("created_at", -1).to_list(300)
    return [Message(**d) for d in docs]


@router.get("/me/messages/count", response_model=MessageCounts)
async def inbox_count(user: User = Depends(get_current_user)):
    recipient_filter = {"recipient_id": user.id}
    pending = await db.messages.count_documents({**recipient_filter, "status": "pending"})
    total = await db.messages.count_documents(recipient_filter)
    return MessageCounts(pending=pending, total=total)


@router.patch("/me/messages/{message_id}", response_model=Message)
async def moderate_message(message_id: str, input: MessageUpdate, user: User = Depends(get_current_user)):
    doc = await db.messages.find_one({"id": message_id, "recipient_id": user.id})
    if not doc:
        raise HTTPException(status_code=404, detail="Message not found")

    updates: dict = {}
    if input.action == "publish":
        updates["status"] = "published"
        if input.answer.strip():
            updates["answer"] = input.answer.strip()[:400]
    elif input.action == "reject":
        updates["status"] = "rejected"
    elif input.action == "favorite":
        updates["favorite"] = True
    elif input.action == "unfavorite":
        updates["favorite"] = False

    if updates:
        await db.messages.update_one({"id": message_id}, {"$set": updates})
    fresh = await db.messages.find_one({"id": message_id})
    return Message(**fresh)


@router.delete("/me/messages/{message_id}", status_code=204)
async def delete_message(message_id: str, user: User = Depends(get_current_user)):
    await db.messages.delete_one({"id": message_id, "recipient_id": user.id})
    return None
