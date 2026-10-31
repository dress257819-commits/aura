"""Polls — owner creates, visitors vote once (vote switching allowed)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from lib.session import get_current_user
from models.models import (
    Poll,
    PollCreate,
    PollOption,
    PollUpdate,
    User,
    VoteCreate,
    utcnow,
)

router = APIRouter()


@router.get("/me/polls", response_model=list[Poll])
async def my_polls(user: User = Depends(get_current_user)):
    docs = await db.polls.find({"user_id": user.id}).sort("created_at", -1).to_list(50)
    return [Poll(**d) for d in docs]


@router.post("/me/polls", response_model=Poll)
async def create_poll(input: PollCreate, user: User = Depends(get_current_user)):
    options = [o.strip()[:60] for o in input.options if o.strip()]
    if len(input.question.strip()) < 4:
        raise HTTPException(status_code=422, detail="Poll question is too short")
    if len(options) < 2:
        raise HTTPException(status_code=422, detail="A poll needs at least two options")
    # one active poll per profile — creating a new one retires the old
    await db.polls.update_many({"user_id": user.id, "active": True}, {"$set": {"active": False}})
    poll = Poll(
        user_id=user.id,
        question=input.question.strip()[:200],
        options=[PollOption(text=o) for o in options[:5]],
    )
    await db.polls.insert_one(poll.model_dump())
    return poll


@router.patch("/me/polls/{poll_id}", response_model=Poll)
async def update_poll(poll_id: str, input: PollUpdate, user: User = Depends(get_current_user)):
    doc = await db.polls.find_one({"id": poll_id, "user_id": user.id})
    if not doc:
        raise HTTPException(status_code=404, detail="Poll not found")
    updates = {k: v for k, v in input.model_dump().items() if v is not None}
    if updates:
        await db.polls.update_one({"id": poll_id}, {"$set": updates})
    fresh = await db.polls.find_one({"id": poll_id})
    return Poll(**fresh)


@router.delete("/me/polls/{poll_id}", status_code=204)
async def delete_poll(poll_id: str, user: User = Depends(get_current_user)):
    await db.polls.delete_one({"id": poll_id, "user_id": user.id})
    return None


@router.post("/u/{username}/polls/{poll_id}/vote", response_model=Poll)
async def vote(username: str, poll_id: str, input: VoteCreate):
    doc = await db.users.find_one({"username": username.lower()})
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    poll_doc = await db.polls.find_one({"id": poll_id, "user_id": doc["id"], "active": True})
    if not poll_doc:
        raise HTTPException(status_code=404, detail="No active poll")
    if not any(o["id"] == input.option_id for o in poll_doc["options"]):
        raise HTTPException(status_code=422, detail="Invalid option")
    voter_id = input.voter_id.strip()[:64] or "anon"

    existing = await db.poll_votes.find_one({"poll_id": poll_id, "voter_id": voter_id})
    if existing and existing["option_id"] == input.option_id:
        return Poll(**poll_doc)  # same vote, idempotent

    if existing:
        await db.polls.update_one(
            {"id": poll_id, "options.id": existing["option_id"]},
            {"$inc": {"options.$.votes": -1}},
        )
        await db.poll_votes.update_one(
            {"id": existing["id"]}, {"$set": {"option_id": input.option_id, "created_at": utcnow()}}
        )
    else:
        await db.poll_votes.insert_one(
            {"id": str(uuid.uuid4()), "poll_id": poll_id, "option_id": input.option_id,
             "voter_id": voter_id, "created_at": utcnow()}
        )
    await db.polls.update_one(
        {"id": poll_id, "options.id": input.option_id}, {"$inc": {"options.$.votes": 1}}
    )
    await db.events.insert_one(
        {"id": str(uuid.uuid4()), "user_id": doc["id"], "type": "poll_vote",
         "meta": {"poll_id": poll_id}, "created_at": utcnow()}
    )
    fresh = await db.polls.find_one({"id": poll_id})
    return Poll(**fresh)
