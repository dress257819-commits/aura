"""Explore — discoverable public profiles with tag search."""

import re
from datetime import timedelta

from fastapi import APIRouter, Depends

from lib.db import db
from lib.session import get_optional_user
from models.models import LeaderboardResponse, User, utcnow

router = APIRouter()

LEADERBOARD_WINDOW_DAYS = 14


@router.get("/explore")
async def explore(
    q: str = "",
    tag: str = "",
    viewer: User | None = Depends(get_optional_user),
):
    query: dict = {}
    if q.strip():
        needle = re.escape(q.strip().lower())
        query["$or"] = [
            {"username": {"$regex": needle, "$options": "i"}},
            {"name": {"$regex": needle, "$options": "i"}},
            {"bio": {"$regex": needle, "$options": "i"}},
            {"interests": {"$regex": needle, "$options": "i"}},
        ]
    elif tag.strip():
        query["interests"] = {"$regex": re.escape(tag.strip().lower()), "$options": "i"}

    docs = await db.users.find(query).to_list(100)
    followed_ids: set[str] = set()
    if viewer and docs:
        followed = await db.follows.find(
            {
                "follower_id": viewer.id,
                "target_id": {"$in": [doc["id"] for doc in docs]},
            },
            {"target_id": 1},
        ).to_list(len(docs))
        followed_ids = {item["target_id"] for item in followed}

    cards = []
    for d in docs:
        followers = await db.follows.count_documents({"target_id": d["id"]})
        cards.append({
            "username": d["username"],
            "name": d.get("name", ""),
            "avatar_url": d.get("avatar_url", ""),
            "cover_url": d.get("cover_url", ""),
            "bio": d.get("bio", "")[:140],
            "interests": d.get("interests", [])[:4],
            "followers": followers,
            "following": d["id"] in followed_ids,
            "plan": d.get("plan", "free"),
            "theme": d.get("appearance", {}).get("theme", "aurora"),
        })
    cards.sort(key=lambda c: (c["plan"] != "creator", c["plan"] != "pro", -c["followers"]))
    return cards


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def leaderboard():
    creators = await db.users.find(
        {"leaderboard_visible": True},
        {"_id": 0, "id": 1, "username": 1, "name": 1, "avatar_url": 1},
    ).to_list(500)
    if not creators:
        return LeaderboardResponse(period_days=LEADERBOARD_WINDOW_DAYS, entries=[])

    creator_ids = [creator["id"] for creator in creators]
    since = utcnow() - timedelta(days=LEADERBOARD_WINDOW_DAYS)
    event_counts = await db.events.aggregate([
        {
            "$match": {
                "user_id": {"$in": creator_ids},
                "type": {"$in": ["profile_view", "link_click"]},
                "created_at": {"$gte": since},
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "profile_views": {
                    "$sum": {"$cond": [{"$eq": ["$type", "profile_view"]}, 1, 0]}
                },
                "link_clicks": {
                    "$sum": {"$cond": [{"$eq": ["$type", "link_click"]}, 1, 0]}
                },
            }
        },
    ]).to_list(500)
    counts_by_creator = {counts["_id"]: counts for counts in event_counts}
    active_polls = await db.polls.find(
        {"user_id": {"$in": creator_ids}, "active": True},
        {"_id": 0, "id": 1, "user_id": 1},
    ).to_list(500)
    poll_ids = [poll["id"] for poll in active_polls]
    votes_by_creator: dict[str, int] = {}
    if poll_ids:
        vote_counts = await db.poll_votes.aggregate([
            {
                "$match": {
                    "poll_id": {"$in": poll_ids},
                    "created_at": {"$gte": since},
                }
            },
            {"$group": {"_id": "$poll_id", "count": {"$sum": 1}}},
        ]).to_list(500)
        poll_owners = {poll["id"]: poll["user_id"] for poll in active_polls}
        for vote in vote_counts:
            owner_id = poll_owners[vote["_id"]]
            votes_by_creator[owner_id] = votes_by_creator.get(owner_id, 0) + vote["count"]

    followers = await db.follows.aggregate([
        {"$match": {"target_id": {"$in": creator_ids}}},
        {"$group": {"_id": "$target_id", "count": {"$sum": 1}}},
    ]).to_list(500)
    followers_by_creator = {item["_id"]: item["count"] for item in followers}

    entries = []
    for creator in creators:
        counts = counts_by_creator.get(creator["id"], {})
        link_clicks = counts.get("link_clicks", 0)
        poll_votes = votes_by_creator.get(creator["id"], 0)
        entries.append({
            "username": creator["username"],
            "name": creator.get("name", ""),
            "avatar_url": creator.get("avatar_url", ""),
            "interactions": link_clicks + poll_votes,
            "profile_views": counts.get("profile_views", 0),
            "link_clicks": link_clicks,
            "poll_votes": poll_votes,
            "followers": followers_by_creator.get(creator["id"], 0),
        })

    entries.sort(
        key=lambda entry: (
            -entry["interactions"],
            -entry["profile_views"],
            -entry["followers"],
            entry["username"],
        )
    )
    ranked_entries = [
        {"rank": rank, **entry} for rank, entry in enumerate(entries[:100], start=1)
    ]
    return LeaderboardResponse(
        period_days=LEADERBOARD_WINDOW_DAYS,
        entries=ranked_entries,
    )
