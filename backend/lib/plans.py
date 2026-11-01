"""Freemium plan limits — enforced server-side on every write."""

from datetime import datetime, timezone

from models.models import utcnow

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


def limits_for(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


def effective_plan(user: dict, now: datetime | None = None) -> str:
    plan = user.get("plan", "free")
    expires_at = user.get("plan_expires_at")
    if plan != "free" and expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        current = now or utcnow()
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        if expires_at <= current:
            return "free"
    return plan if plan in PLAN_LIMITS else "free"


def appearance_for_plan(appearance: dict, plan: str) -> dict:
    limits = limits_for(plan)
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
