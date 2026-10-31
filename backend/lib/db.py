"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
db_name = os.getenv("DB_NAME", "aura")
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("username", ASCENDING)], name="username", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("google_sub", ASCENDING)], name="google_sub", unique=True, sparse=True),
        IndexModel([("leaderboard_visible", ASCENDING)], name="leaderboard_visible"),
    ],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("user_id", ASCENDING)], name="user_id"),
    ],
    "links": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING), ("sort_order", ASCENDING)], name="user_sort"),
    ],
    "gallery": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
    ],
    "messages": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel(
            [("recipient_id", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)],
            name="recipient_status_created",
        ),
        IndexModel([("visitor_id", ASCENDING), ("created_at", DESCENDING)], name="visitor_rate"),
    ],
    "polls": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("user_id", ASCENDING), ("active", ASCENDING)], name="user_active"),
    ],
    "poll_votes": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("poll_id", ASCENDING), ("voter_id", ASCENDING)], name="poll_voter", unique=True),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
    ],
    "follows": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("follower_id", ASCENDING), ("target_id", ASCENDING)], name="pair", unique=True),
        IndexModel([("target_id", ASCENDING)], name="target"),
    ],
    "events": [
        IndexModel([("user_id", ASCENDING), ("type", ASCENDING), ("created_at", DESCENDING)], name="analytics"),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
    ],
    "chat_messages": [
        IndexModel([("session_id", ASCENDING), ("created_at", ASCENDING)], name="session_history"),
        IndexModel([("owner_id", ASCENDING), ("created_at", DESCENDING)], name="owner_recent"),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
