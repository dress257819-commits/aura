"""Freemium plan limits — enforced server-side on every write."""

PLAN_LIMITS = {
    "free": {
        "links": 5,
        "gallery": 3,
        "themes": ["aurora", "minimal", "aura-editorial", "matcha"],
        "fonts": ["jakarta", "dm-sans"],
        "card_styles": ["rounded", "soft"],
        "custom_css": False,
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
        "glass": 3,
        "effects": True,
    },
}


def limits_for(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
