"""Billing — plan catalogue + simulated upgrade (no live payment capture)."""

from fastapi import APIRouter, Depends

from lib.db import db
from lib.session import get_current_user
from models.models import MeProfile, PlanInfo, UpgradeCreate, User

router = APIRouter()

PLANS = [
    PlanInfo(
        key="free",
        name="Free",
        price=0,
        tagline="Your identity, online in minutes.",
        features=[
            "Beautiful profile with avatar, bio & interests",
            "Up to 5 link cards",
            "3 signature themes",
            "Anonymous messages + public Q&A",
            "1 live poll",
            "AI twin with standard answers",
            "Basic analytics",
        ],
    ),
    PlanInfo(
        key="pro",
        name="Pro",
        price=9,
        tagline="For creators building an audience.",
        features=[
            "Everything in Free",
            "Up to 15 link cards",
            "All themes incl. Cyber Tokyo & Neo-Brutalist",
            "Custom accent + glassmorphism control",
            "Advanced analytics & top-link ranking",
            "Priority discovery in Explore",
            "Verified-style profile badge",
        ],
    ),
    PlanInfo(
        key="creator",
        name="Creator",
        price=29,
        tagline="A full studio for your internet identity.",
        features=[
            "Everything in Pro",
            "Unlimited links & 50-item gallery",
            "Exclusive Luxe theme + custom CSS",
            "Premium fonts & typography control",
            "AI twin with custom instructions & boundaries",
            "Story studio export in 1080×1920",
            "Early access to new widgets",
        ],
    ),
]


@router.get("/plans", response_model=list[PlanInfo])
async def list_plans():
    return PLANS


@router.post("/me/upgrade", response_model=MeProfile)
async def upgrade(input: UpgradeCreate, user: User = Depends(get_current_user)):
    # Simulated checkout: in production this follows a Stripe/Razorpay webhook.
    await db.users.update_one({"id": user.id}, {"$set": {"plan": input.plan}})
    doc = await db.users.find_one({"id": user.id})
    return MeProfile(**doc)
