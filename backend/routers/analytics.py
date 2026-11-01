"""Analytics — event tracking for visitors, aggregates for the owner."""

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.session import get_current_user
from models.models import (
    AnalyticsSummary, DaySeriesPoint, EventCreate, TopLink, User, utcnow,
)

router = APIRouter()

WINDOW_DAYS = 14


@router.post("/u/{username}/events")
async def track_event(username: str, input: EventCreate):
    doc = await db.users.find_one({"username": username.lower()})
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    await db.events.insert_one(
        {"id": str(uuid.uuid4()), "user_id": doc["id"], "type": input.type,
         "meta": {"ref": input.ref[:100]}, "created_at": utcnow()}
    )
    return {"ok": True}


@router.get("/me/analytics", response_model=AnalyticsSummary)
async def my_analytics(user: User = Depends(get_current_user)):
    since = utcnow() - timedelta(days=WINDOW_DAYS)

    totals: dict = {}
    for etype in ("profile_view", "link_click", "message_received", "poll_vote", "share"):
        totals[etype] = await db.events.count_documents(
            {"user_id": user.id, "type": etype, "created_at": {"$gte": since}}
        )
    totals["followers"] = await db.follows.count_documents({"target_id": user.id})

    # 14-day series anchored server-side (pod clock is UTC)
    days: list[DaySeriesPoint] = []
    advanced_analytics = user.plan in {"pro", "creator"}
    for offset in range(WINDOW_DAYS - 1, -1, -1) if advanced_analytics else []:
        day_start = (utcnow() - timedelta(days=offset)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        day_end = day_start + timedelta(days=1)
        label = day_start.strftime("%Y-%m-%d")
        point = DaySeriesPoint(date=label)
        for etype, field in (
            ("profile_view", "views"),
            ("link_click", "clicks"),
            ("message_received", "messages"),
        ):
            point.__setattr__(
                field,
                await db.events.count_documents(
                    {"user_id": user.id, "type": etype,
                     "created_at": {"$gte": day_start, "$lt": day_end}}
                ),
            )
        days.append(point)

    links = (
        await db.links.find({"user_id": user.id})
        .sort("clicks", -1)
        .to_list(5)
    ) if advanced_analytics else []
    top_links = [TopLink(id=l["id"], title=l["title"], clicks=l["clicks"]) for l in links]

    pending = await db.messages.count_documents(
        {"recipient_id": user.id, "status": "pending"}
    )
    chat_count = await db.chat_messages.count_documents(
        {"owner_id": user.id, "role": "user"}
    )

    return AnalyticsSummary(
        totals=totals, days=days, top_links=top_links,
        followers=totals["followers"], messages_pending=pending, chat_messages=chat_count,
    )
