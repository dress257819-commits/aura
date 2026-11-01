"""Public profiles + owner profile editing + gallery + follows."""

import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from lib.db import db
from lib.plans import appearance_for_plan, effective_plan, limits_for
from lib.session import get_current_user, get_optional_user
from models.models import (
    Appearance,
    GalleryCreate,
    GalleryItem,
    GalleryUpdate,
    Link,
    MeProfile,
    Message,
    MusicTrack,
    Poll,
    ProfileBundle,
    PublicProfile,
    User,
    utcnow,
)

router = APIRouter()
logger = logging.getLogger(__name__)

RESERVED = {
    "dashboard", "auth", "login", "signup", "u", "api", "explore", "leaderboard", "pricing",
    "assets", "static", "mosaic", "admin", "settings", "profile",
}


def public_profile(doc: dict) -> PublicProfile:
    chatbot = doc.get("chatbot", {})
    plan = effective_plan(doc)
    appearance = appearance_for_plan(doc.get("appearance", {}), plan)
    try:
        appearance["custom_css"] = sanitize_custom_css(appearance.get("custom_css", ""))
    except HTTPException:
        logger.warning("Ignoring invalid stored custom CSS for user %s", doc.get("id"))
        appearance["custom_css"] = ""
    return PublicProfile(
        id=doc["id"],
        username=doc["username"],
        name=doc.get("name", ""),
        bio=doc.get("bio", ""),
        location=doc.get("location", ""),
        avatar_url=doc.get("avatar_url", ""),
        cover_url=doc.get("cover_url", ""),
        interests=doc.get("interests", []),
        daily_question=doc.get("daily_question", ""),
        music=[MusicTrack(**m) for m in doc.get("music", [])],
        appearance=Appearance(**appearance),
        plan=plan,
        created_at=doc["created_at"],
        chatbot={
            "enabled": chatbot.get("enabled", True),
            "name": chatbot.get("name", "AI Twin"),
            "greeting": chatbot.get("greeting", "Hey! Ask me anything about me."),
        },
    )


class ProfileUpdate(BaseModel):
    name: str | None = None
    username: str | None = None
    bio: str | None = None
    location: str | None = None
    avatar_url: str | None = None
    cover_url: str | None = None
    interests: list[str] | None = None
    daily_question: str | None = None
    music: list[MusicTrack] | None = None
    leaderboard_visible: bool | None = None


class AppearanceUpdate(BaseModel):
    theme: str | None = None
    font: str | None = None
    accent: str | None = None
    card_style: str | None = None
    glass: int | None = None
    effects: bool | None = None
    custom_css: str | None = None


CUSTOM_CSS_SELECTOR = re.compile(
    r"\.aura-profile(?:\s+(?:\.aura-link-card|h1|h2|p)(?::hover)?)?"
)
CUSTOM_CSS_PROPERTIES = {
    "color",
    "background-color",
    "border-color",
    "border-radius",
    "box-shadow",
    "font-weight",
    "letter-spacing",
    "text-transform",
}


def sanitize_custom_css(value: str) -> str:
    css = value.strip()
    if len(css) > 5000:
        raise HTTPException(status_code=422, detail="Custom CSS must be 5,000 characters or fewer")
    if not css:
        return ""

    rules: list[str] = []
    position = 0
    while position < len(css):
        match = re.match(r"\s*([^{}]+)\{([^{}]*)\}", css[position:])
        if not match:
            raise HTTPException(status_code=422, detail="Use valid, scoped CSS rules")
        selector, declarations = match.groups()
        selectors = [item.strip() for item in selector.split(",")]
        if any(not CUSTOM_CSS_SELECTOR.fullmatch(item) for item in selectors):
            raise HTTPException(
                status_code=422,
                detail="Custom CSS selectors must stay within .aura-profile",
            )

        safe_declarations = []
        for declaration in declarations.split(";"):
            if not declaration.strip():
                continue
            property_name, separator, property_value = declaration.partition(":")
            name = property_name.strip().lower()
            val = property_value.strip()
            if (
                not separator
                or name not in CUSTOM_CSS_PROPERTIES
                or not re.fullmatch(r"[a-zA-Z0-9#(),.%\s-]+", val)
                or re.search(r"url|expression|javascript", val, re.IGNORECASE)
            ):
                raise HTTPException(
                    status_code=422,
                    detail="Custom CSS supports scoped color, border, shadow, and typography properties only",
                )
            safe_declarations.append(f"{name}: {val}")
        if safe_declarations:
            rules.append(f"{', '.join(selectors)} {{{'; '.join(safe_declarations)}}}")
        position += match.end()

    return "\n".join(rules)


# ---------- public bundle ----------

@router.get("/u/{username}", response_model=ProfileBundle)
async def get_profile(username: str, viewer: User | None = Depends(get_optional_user)):
    doc = await db.users.find_one({"username": username.lower()})
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")

    links = (
        await db.links.find({"user_id": doc["id"], "active": True})
        .sort("sort_order", ASCENDING)
        .to_list(200)
    )
    gallery = await db.gallery.find({"user_id": doc["id"]}).sort("created_at", -1).to_list(50)
    poll_doc = await db.polls.find_one({"user_id": doc["id"], "active": True})
    qa_docs = (
        await db.messages.find({"recipient_id": doc["id"], "status": "published"})
        .sort("created_at", -1)
        .to_list(30)
    )
    followers = await db.follows.count_documents({"target_id": doc["id"]})

    following = False
    if viewer:
        following = bool(
            await db.follows.find_one({"follower_id": viewer.id, "target_id": doc["id"]})
        )

    return ProfileBundle(
        profile=public_profile(doc),
        links=[Link(**l) for l in links],
        gallery=[GalleryItem(**g) for g in gallery],
        poll=Poll(**poll_doc) if poll_doc else None,
        qa=[Message(**m) for m in qa_docs],
        followers=followers,
        following=following,
    )


@router.get("/me/profile/username-availability")
async def username_availability(
    username: str = Query(min_length=1, max_length=24),
    user: User = Depends(get_current_user),
):
    candidate = username.strip().lower()
    if candidate == user.username:
        return {"available": True, "current": True}
    if not re.fullmatch(r"[a-z0-9_]{3,24}", candidate) or candidate in RESERVED:
        return {"available": False, "reason": "Invalid or reserved username"}
    taken = await db.users.find_one({"username": candidate}, {"_id": 1})
    return {
        "available": not bool(taken),
        "reason": "That username is already taken" if taken else None,
    }


# ---------- owner editing ----------

@router.patch("/me/profile", response_model=MeProfile)
async def update_profile(input: ProfileUpdate, user: User = Depends(get_current_user)):
    updates: dict = {}
    if input.username is not None and input.username.strip().lower() != user.username:
        new_username = input.username.strip().lower()
        if not re.match(r"^[a-z0-9_]{3,24}$", new_username) or new_username in RESERVED:
            raise HTTPException(status_code=422, detail="Invalid or reserved username")
        if await db.users.find_one({"username": new_username, "id": {"$ne": user.id}}):
            raise HTTPException(status_code=409, detail="That username is taken")
        updates["username"] = new_username
    limits = {"name": 60, "bio": 400, "location": 60, "avatar_url": 500,
              "cover_url": 500, "daily_question": 200}
    for field, max_len in limits.items():
        value = getattr(input, field)
        if value is not None:
            value = value.strip()[:max_len]
            if field == "cover_url" and user.plan == "free" and value and value != user.cover_url:
                raise HTTPException(
                    status_code=403,
                    detail="Profile banners are available on Pro and Creator plans",
                )
            updates[field] = value
    if input.interests is not None:
        updates["interests"] = [i.strip()[:24] for i in input.interests[:8] if i.strip()]
    if input.music is not None:
        updates["music"] = [m.model_dump() for m in input.music[:5]]
    if input.leaderboard_visible is not None:
        updates["leaderboard_visible"] = input.leaderboard_visible

    if updates:
        try:
            await db.users.update_one({"id": user.id}, {"$set": updates})
        except DuplicateKeyError as exc:
            if "username" in updates:
                raise HTTPException(status_code=409, detail="That username is taken") from exc
            raise
    doc = await db.users.find_one({"id": user.id})
    return MeProfile(**doc)


@router.patch("/me/appearance", response_model=MeProfile)
async def update_appearance(input: AppearanceUpdate, user: User = Depends(get_current_user)):
    limits = limits_for(user.plan)
    appearance = user.appearance.model_dump()

    if input.theme is not None:
        if input.theme not in limits["themes"]:
            raise HTTPException(
                status_code=403,
                detail=f"The '{input.theme}' theme needs a higher plan — upgrade to unlock it.",
            )
        appearance["theme"] = input.theme
    if input.font is not None:
        if input.font not in limits["fonts"]:
            raise HTTPException(status_code=403, detail="That font needs a higher plan")
        appearance["font"] = input.font
    if input.card_style is not None:
        if input.card_style not in limits["card_styles"]:
            raise HTTPException(
                status_code=403,
                detail=f"The '{input.card_style}' card style needs a higher plan.",
            )
        appearance["card_style"] = input.card_style
    if input.accent is not None:
        if not re.match(r"^#[0-9a-fA-F]{6}$", input.accent):
            raise HTTPException(status_code=422, detail="Accent must be a hex colour")
        appearance["accent"] = input.accent
    if input.glass is not None:
        if input.glass > limits["glass"]:
            raise HTTPException(status_code=403, detail="That glass intensity needs a higher plan")
        appearance["glass"] = max(0, min(3, input.glass))
    if input.effects is not None:
        appearance["effects"] = input.effects
    if input.custom_css is not None:
        if not limits["custom_css"] and input.custom_css.strip():
            raise HTTPException(status_code=403, detail="Custom CSS is a Creator feature")
        appearance["custom_css"] = sanitize_custom_css(input.custom_css)

    await db.users.update_one({"id": user.id}, {"$set": {"appearance": appearance}})
    doc = await db.users.find_one({"id": user.id})
    return MeProfile(**doc)


# ---------- gallery ----------

@router.get("/me/gallery", response_model=list[GalleryItem])
async def my_gallery(user: User = Depends(get_current_user)):
    docs = await db.gallery.find({"user_id": user.id}).sort("created_at", -1).to_list(50)
    return [GalleryItem(**doc) for doc in docs]


@router.post("/me/gallery", response_model=GalleryItem)
async def add_gallery_item(input: GalleryCreate, user: User = Depends(get_current_user)):
    limits = limits_for(user.plan)
    count = await db.gallery.count_documents({"user_id": user.id})
    if count >= limits["gallery"]:
        raise HTTPException(
            status_code=403,
            detail=f"Your {user.plan} plan allows {limits['gallery']} gallery items — upgrade for more.",
        )
    item = GalleryItem(user_id=user.id, url=input.url.strip(), caption=input.caption.strip()[:120])
    await db.gallery.insert_one(item.model_dump())
    return item


@router.patch("/me/gallery/{item_id}", response_model=GalleryItem)
async def update_gallery_item(
    item_id: str,
    input: GalleryUpdate,
    user: User = Depends(get_current_user),
):
    updates = input.model_dump(exclude_unset=True)
    if updates.get("url") is None:
        updates.pop("url", None)
    else:
        updates["url"] = updates["url"].strip()[:500]
    if updates.get("caption") is None:
        updates.pop("caption", None)
    else:
        updates["caption"] = updates["caption"].strip()[:120]
    if not updates:
        raise HTTPException(status_code=422, detail="Provide an image URL or caption to update")

    result = await db.gallery.update_one(
        {"id": item_id, "user_id": user.id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Gallery image not found")
    item = await db.gallery.find_one({"id": item_id, "user_id": user.id})
    return GalleryItem(**item)


@router.delete("/me/gallery/{item_id}", status_code=204)
async def delete_gallery_item(item_id: str, user: User = Depends(get_current_user)):
    await db.gallery.delete_one({"id": item_id, "user_id": user.id})
    return None


# ---------- follows ----------

@router.post("/u/{username}/follow")
async def toggle_follow(username: str, user: User = Depends(get_current_user)):
    target = await db.users.find_one({"username": username.lower()})
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")
    if target["id"] == user.id:
        raise HTTPException(status_code=422, detail="You cannot follow yourself")

    existing = await db.follows.find_one({"follower_id": user.id, "target_id": target["id"]})
    if existing:
        await db.follows.delete_one({"id": existing["id"]})
        following = False
    else:
        try:
            await db.follows.insert_one(
                {"id": str(uuid.uuid4()), "follower_id": user.id,
                 "target_id": target["id"], "created_at": utcnow()}
            )
        except DuplicateKeyError:
            existing = await db.follows.find_one(
                {"follower_id": user.id, "target_id": target["id"]}
            )
            if not existing:
                raise
            following = True
        else:
            following = True
    followers = await db.follows.count_documents({"target_id": target["id"]})
    return {"following": following, "followers": followers}
