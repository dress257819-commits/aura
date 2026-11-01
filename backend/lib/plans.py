"""Plan entitlements and the site-wide 30-day all-features promotion."""

import os
from datetime import datetime, timezone

from models.models import utcnow

DEFAULT_FREE_ACCESS_END = datetime(2026, 12, 1, 16, 36, 13, 739000, tzinfo=timezone.utc)


def free_access_until() -> datetime:
    value = os.environ.get("AURA_FREE_ACCESS_END")
    if not value:
        return DEFAULT_FREE_ACCESS_END
    try:
        end = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("AURA_FREE_ACCESS_END must be an ISO-8601 datetime with timezone") from exc
    if end.tzinfo is None:
        raise ValueError("AURA_FREE_ACCESS_END must include a timezone")
    return end.astimezone(timezone.utc)


def free_access_active(now: datetime | None = None) -> bool:
    current_time = now or utcnow()
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    return current_time < free_access_until()

PLAN_LIMITS = {
    "free": {
        "links": 5,
        "gallery": 3,
        "themes": ["aurora", "minimal", "aura-editorial", "matcha"],
        "fonts": ["jakarta", "dm-sans"],
        "card_styles": ["rounded", "soft"],
        "custom_css": False,
        "ai_customization": False,
        "glass": 2,          # max glass intensity
        "effects": True,
    },
    "pro": {
        "links": 15,
        "gallery": 12,
        "themes": ["aurora", "minimal", "aura-editorial", "matcha", "cyber", "neo", "creator-hub"],
        "fonts": ["jakarta", "dm-sans", "sora", "space-grotesk"],
        "card_styles": ["rounded", "soft", "editorial", "glass"],
        "custom_css": False,
        "ai_customization": False,
        "glass": 3,
        "effects": True,
    },
    "creator": {
        "links": 100,
        "gallery": 50,
        "themes": ["aurora", "minimal", "aura-editorial", "matcha", "cyber", "neo", "luxe", "creator-hub"],
        "fonts": ["jakarta", "dm-sans", "sora", "space-grotesk", "playfair", "lora"],
        "card_styles": ["rounded", "soft", "editorial", "glass", "outline"],
        "custom_css": True,
        "ai_customization": True,
        "glass": 3,
        "effects": True,
    },
}


def limits_for(plan: str, now: datetime | None = None) -> dict:
    if free_access_active(now):
        return PLAN_LIMITS["creator"]
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


def effective_plan(user: dict, _now: datetime | None = None) -> str:
    if free_access_active(_now):
        return "creator"

    plan = user.get("plan", "free")
    expires_at = user.get("plan_expires_at")
    current_time = _now or utcnow()
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at <= current_time:
        return "free"
    return plan if plan in PLAN_LIMITS else "free"


def appearance_for_plan(
    appearance: dict, plan: str, now: datetime | None = None
) -> dict:
    limits = limits_for(plan, now)
    result = dict(appearance)
    if result.get("theme") not in limits["themes"]:
        result["theme"] = "minimal"
    if result.get("font") not in limits["fonts"]:
        result["font"] = "jakarta"
    if result.get("card_style") not in limits["card_styles"]:
        result["card_style"] = "rounded"
    result["glass"] = min(max(int(result.get("glass", 2)), 0), limits["glass"])
    if not limits["custom_css"]:
        result["custom_css"] = ""
    return result
