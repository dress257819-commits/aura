"""Pydantic v2 models — every request/response body. Hand-mirrored in frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def utcnow() -> datetime:
    """Aware UTC — BSON stores UTC; Pydantic serialises the offset so JS parses it."""
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- appearance & themes ----------

class Appearance(BaseModel):
    theme: str = "minimal"           # preset key, see lib/plans.py for tier gating
    font: str = "jakarta"            # heading font key
    accent: str = "#6366F1"          # user-selectable accent hex
    card_style: str = "rounded"      # link card presentation
    glass: int = 2                   # 0-3 glassmorphism intensity (pro+)
    effects: bool = True             # animated background aurora
    custom_css: str = ""             # creator only


class ChatbotSettings(BaseModel):
    enabled: bool = True
    name: str = "AI Twin"
    tone: Literal["witty", "professional", "genz", "whimsical"] = "genz"
    greeting: str = "Hey! Ask me anything about me."
    boundaries: List[str] = Field(default_factory=list)
    instructions: str = ""           # extra owner-approved knowledge notes


class MusicTrack(BaseModel):
    title: str
    artist: str = ""
    url: str = ""


# ---------- user ----------

class User(BaseModel):
    id: str = Field(default_factory=new_id)
    email: str
    password_hash: str = ""
    username: str
    name: str
    bio: str = ""
    location: str = ""
    avatar_url: str = ""
    cover_url: str = ""
    interests: List[str] = Field(default_factory=list)
    daily_question: str = ""
    music: List[MusicTrack] = Field(default_factory=list)
    appearance: Appearance = Field(default_factory=Appearance)
    chatbot: ChatbotSettings = Field(default_factory=ChatbotSettings)
    leaderboard_visible: bool = False
    plan: Literal["free", "pro", "creator"] = "free"
    plan_expires_at: Optional[datetime] = None
    stripe_subscription_id: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


# Public view of a profile (no email, no password hash, no private chatbot config)
class PublicChatbot(BaseModel):
    enabled: bool = True
    name: str = "AI Twin"
    greeting: str = "Hey! Ask me anything about me."


class PublicProfile(BaseModel):
    id: str
    username: str
    name: str
    bio: str = ""
    location: str = ""
    avatar_url: str = ""
    cover_url: str = ""
    interests: List[str] = Field(default_factory=list)
    daily_question: str = ""
    music: List[MusicTrack] = Field(default_factory=list)
    appearance: Appearance = Field(default_factory=Appearance)
    plan: str = "free"
    created_at: datetime
    chatbot: PublicChatbot = Field(default_factory=PublicChatbot)


# Own view (dashboard) — includes email + private chatbot config
class MeProfile(BaseModel):
    id: str
    email: str
    username: str
    name: str
    bio: str = ""
    location: str = ""
    avatar_url: str = ""
    cover_url: str = ""
    interests: List[str] = Field(default_factory=list)
    daily_question: str = ""
    music: List[MusicTrack] = Field(default_factory=list)
    appearance: Appearance = Field(default_factory=Appearance)
    chatbot: ChatbotSettings = Field(default_factory=ChatbotSettings)
    leaderboard_visible: bool = False
    plan: str = "free"
    created_at: datetime


class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    name: str
    avatar_url: str = ""
    interactions: int
    profile_views: int
    link_clicks: int
    poll_votes: int
    followers: int


class LeaderboardResponse(BaseModel):
    period_days: int
    entries: List[LeaderboardEntry]


# ---------- auth ----------

class SignupCreate(BaseModel):
    email: str
    password: str
    name: str
    username: str


class LoginCreate(BaseModel):
    email: str
    password: str


# ---------- links ----------

class Link(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    platform: str = "custom"       # platform key from platforms.ts, or "custom"
    title: str
    url: str
    description: str = ""
    thumbnail_url: str = ""
    icon_url: str = ""
    sort_order: int = 0
    clicks: int = 0
    active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class LinkCreate(BaseModel):
    platform: str = "custom"
    title: str
    url: str
    description: str = ""
    thumbnail_url: str = ""
    icon_url: str = ""


class LinkUpdate(BaseModel):
    platform: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    icon_url: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None


# ---------- gallery ----------

class GalleryItem(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    url: str
    caption: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class GalleryCreate(BaseModel):
    url: str
    caption: str = ""


class GalleryUpdate(BaseModel):
    url: Optional[str] = None
    caption: Optional[str] = None


# ---------- messages (anonymous) ----------

class Message(BaseModel):
    id: str = Field(default_factory=new_id)
    recipient_id: str
    recipient_username: str
    content: str
    sender_name: str = "Anonymous"
    status: Literal["pending", "published", "rejected"] = "pending"
    answer: str = ""
    favorite: bool = False
    visitor_id: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class MessageCreate(BaseModel):
    content: str
    sender_name: str = "Anonymous"
    visitor_id: str = ""


class MessageUpdate(BaseModel):
    action: Literal["publish", "reject", "favorite", "unfavorite"]
    answer: str = ""


class MessageCounts(BaseModel):
    pending: int
    total: int


# ---------- polls ----------

class PollOption(BaseModel):
    id: str = Field(default_factory=new_id)
    text: str
    votes: int = 0


class Poll(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    question: str
    options: List[PollOption] = Field(default_factory=list)
    active: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class PollCreate(BaseModel):
    question: str
    options: List[str]


class PollUpdate(BaseModel):
    question: Optional[str] = None
    active: Optional[bool] = None


class VoteCreate(BaseModel):
    option_id: str
    voter_id: str


# ---------- follows ----------

class Follow(BaseModel):
    id: str = Field(default_factory=new_id)
    follower_id: str
    target_id: str
    created_at: datetime = Field(default_factory=utcnow)


# ---------- analytics ----------

class EventCreate(BaseModel):
    type: Literal["profile_view", "share"]
    ref: str = ""


class DaySeriesPoint(BaseModel):
    date: str
    views: int = 0
    clicks: int = 0
    messages: int = 0


class TopLink(BaseModel):
    id: str
    title: str
    clicks: int


class AnalyticsSummary(BaseModel):
    totals: dict
    days: List[DaySeriesPoint]
    top_links: List[TopLink]
    followers: int = 0
    messages_pending: int = 0
    chat_messages: int = 0


# ---------- chat (AI twin) ----------

class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatCreate(BaseModel):
    message: str
    session_id: str
    history: List[ChatTurn] = Field(default_factory=list)


class AiSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    name: Optional[str] = None
    tone: Optional[Literal["witty", "professional", "genz", "whimsical"]] = None
    greeting: Optional[str] = None
    boundaries: Optional[List[str]] = None
    instructions: Optional[str] = None


# ---------- billing ----------

class PlanInfo(BaseModel):
    key: str
    name: str
    price: int
    nepal_price: int
    tagline: str
    features: List[str]


class CheckoutCreate(BaseModel):
    plan: Literal["pro", "creator"]
    region: Literal["international", "nepal"]
    provider: Literal["stripe", "esewa", "khalti"]


class CheckoutResponse(BaseModel):
    payment_id: str
    provider: str
    checkout_url: str
    form_fields: dict[str, str] = Field(default_factory=dict)


# ---------- profile bundle ----------

class ProfileBundle(BaseModel):
    profile: PublicProfile
    links: List[Link]
    gallery: List[GalleryItem]
    poll: Optional[Poll] = None
    qa: List[Message]
    followers: int = 0
    following: bool = False
