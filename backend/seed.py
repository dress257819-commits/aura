"""Seed Mosaic with demo creators. Run: cd /app/backend && python seed.py"""

import asyncio
import uuid
from datetime import timedelta

from lib.db import db, ensure_indexes
from models.models import (
    Appearance, ChatbotSettings, GalleryItem, Link, Message, MusicTrack,
    Poll, PollOption, User, utcnow,
)
from passlib.context import CryptContext


def hash_pw(password: str) -> str:
    ctx = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
    return ctx.hash(password)


CREATORS = [
    {
        "email": "simran@aura.app",
        "username": "simran",
        "name": "Simran Khadka",
        "bio": "Good food, better fits, and little things worth sharing.",
        "location": "Kathmandu",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=srgb&fm=jpg&q=85",
        "cover_url": "https://images.unsplash.com/photo-1597407068889-782ba11fb621?crop=entropy&cs=srgb&fm=jpg&q=85",
        "interests": ["Streetwear", "Comfort food", "Music", "Cafe finds", "Skincare"],
        "daily_question": "What's your current comfort-food order?",
        "leaderboard_visible": True,
        "plan": "pro",
        "theme": "minimal", "accent": "#6366F1", "font": "jakarta",
        "music": [
            {"title": "Espresso", "artist": "Sabrina Carpenter", "url": "https://open.spotify.com/search/Espresso%20Sabrina%20Carpenter"},
            {"title": "Birds of a Feather", "artist": "Billie Eilish", "url": "https://open.spotify.com/search/Birds%20of%20a%20Feather%20Billie%20Eilish"},
            {"title": "Golden", "artist": "HUNTR/X", "url": "https://open.spotify.com/search/Golden%20HUNTRX"},
        ],
        "links": [
            {"platform": "instagram", "title": "My everyday looks", "url": "https://instagram.com", "description": "Fits, favorites, and little moments"},
            {"platform": "tiktok", "title": "Food spots I love", "url": "https://tiktok.com", "description": "Comfort food and places worth the trip"},
            {"platform": "pinterest", "title": "Outfit moodboard", "url": "https://pinterest.com", "description": "Pieces and looks on my mind"},
            {"platform": "spotify", "title": "My current playlist", "url": "https://open.spotify.com", "description": "Songs on repeat lately"},
            {"platform": "custom", "title": "Cafe list", "url": "https://maps.google.com", "description": "Saved spots around Kathmandu"},
        ],
        "gallery": [
            {"url": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80", "caption": "A little outfit inspiration"},
            {"url": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80", "caption": "A meal I keep thinking about"},
            {"url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80", "caption": "A cafe worth coming back to"},
        ],
        "chatbot": {"enabled": True, "name": "Simran's Twin", "tone": "genz",
                     "greeting": "hey!! ask me about Simran's favorite food spots, fits, or what's on repeat",
                     "boundaries": [], "instructions": "Simran likes sharing her favorite places, fashion finds, and playlists."},
        "qa": [
            {"content": "Where do you go for momos?", "answer": "I keep a running list of little spots around Kathmandu. My current favorite is in my cafe list!"},
            {"content": "Where do you find outfit inspiration?", "answer": "Mostly people-watching, thrift shops, and saving looks I love to my moodboard."},
        ],
        "pending": [
            {"content": "What cafe is your current favorite?", "sender_name": "Jordan"},
            {"content": "Where did you find that jacket?", "sender_name": "Sam"},
        ],
        "views": 320, "clicks": 80,
    },
    {
        "email": "liam@mosaic.app",
        "username": "liam",
        "name": "Liam Vance",
        "bio": "Music producer & tech explorer. Making beats at 2am and breaking servers by day. Ask me about modular synths.",
        "location": "Berlin, Germany",
        "avatar_url": "https://images.unsplash.com/photo-1629747490241-624f07d70e1e?crop=entropy&cs=srgb&fm=jpg&q=85",
        "cover_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&q=80",
        "interests": ["Music Production", "Modular Synths", "Gaming", "Tech"],
        "daily_question": "Vinyl, cassette or streaming — what's your poison?",
        "plan": "creator",
        "theme": "cyber", "accent": "#EC4899", "font": "space-grotesk",
        "music": [
            {"title": "Windowlicker", "artist": "Aphex Twin", "url": "https://open.spotify.com/search/Windowlicker"},
            {"title": "Xtal", "artist": "Aphex Twin", "url": "https://open.spotify.com/search/Xtal"},
        ],
        "links": [
            {"platform": "spotify", "title": "Latest EP — Neon Wasteland", "url": "https://open.spotify.com", "description": "6 tracks of cyberpunk ambience", "thumbnail_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80"},
            {"platform": "soundcloud", "title": "SoundCloud", "url": "https://soundcloud.com", "description": "WIP beats & un released cuts"},
            {"platform": "tiktok", "title": "TikTok", "url": "https://tiktok.com", "description": "Studio sessions & synth demos"},
            {"platform": "discord", "title": "Producer Discord", "url": "https://discord.com", "description": "Join 4k producers swapping presets"},
        ],
        "gallery": [
            {"url": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80", "caption": "The modular wall, fully patched"},
            {"url": "https://images.unsplash.com/photo-1571330735066-03aaa94236d1?w=800&q=80", "caption": "Studio night #247"},
        ],
        "chatbot": {"enabled": True, "name": "Liam Bot 3000", "tone": "witty",
                     "greeting": "Welcome to my corner of the internet. Ask me about the EP, the synths, or my questionable sleep schedule.",
                     "boundaries": ["exact release dates of unreleased music"], "instructions": "The EP 'Neon Wasteland' dropped last month on all platforms."},
        "qa": [
            {"content": "What synth is on the lead of track 3?", "answer": "That's a Prophet-6 through a Shattered Glass cassette emulator. No presets were harmed."},
        ],
        "pending": [{"content": "any presets for beginners? i just got a minilogue", "sender_name": "Rin"}],
        "views": 210, "clicks": 55,
    },
    {
        "email": "alex@mosaic.app",
        "username": "alex",
        "name": "Alex Rivera",
        "bio": "Indie game dev shipping weird little worlds. Solo dev of 'Moth Signal' — out now on itch.io. Speedrunner in another life.",
        "location": "Mexico City",
        "avatar_url": "https://images.unsplash.com/photo-1529068755536-a5ade0dcb4e8?crop=entropy&cs=srgb&fm=jpg&q=85",
        "cover_url": "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=1600&q=80",
        "interests": ["Game Dev", "Pixel Art", "Speedrunning", "Sci-fi Novels"],
        "daily_question": "What game would you erase from memory just to replay it fresh?",
        "plan": "free",
        "theme": "minimal", "accent": "#059669", "font": "dm-sans",
        "music": [],
        "links": [
            {"platform": "itch", "title": "Moth Signal — out now", "url": "https://itch.io", "description": "A 40-minute noir about moths and radio towers", "thumbnail_url": "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&q=80"},
            {"platform": "discord", "title": "Dev log Discord", "url": "https://discord.com"},
            {"platform": "github", "title": "GitHub", "url": "https://github.com"},
        ],
        "gallery": [
            {"url": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80", "caption": "Pixel mockups for chapter 2"},
        ],
        "chatbot": {"enabled": True, "name": "Signal", "tone": "professional",
                     "greeting": "Hello! I'm Signal, Alex's assistant. Ask about the game, the dev process, or where to play it.",
                     "boundaries": [], "instructions": ""},
        "qa": [{"content": "Will Moth Signal come to consoles?", "answer": "Maybe someday! Focus is on the PC release and the free chapter 2 update first."}],
        "pending": [],
        "views": 120, "clicks": 30,
    },
    {
        "email": "nina@mosaic.app",
        "username": "nina",
        "name": "Nina Okafor",
        "bio": "Fitness coach turning beginners into gym regulars. 5am club evangelist. Protein smoothie sommelier.",
        "location": "London, UK",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=srgb&fm=jpg&q=85",
        "cover_url": "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1600&q=80",
        "interests": ["Fitness", "Nutrition", "Running"],
        "daily_question": "What's the one habit you keep failing to start?",
        "plan": "pro",
        "theme": "matcha", "accent": "#34D399", "font": "outfit",
        "music": [],
        "links": [
            {"platform": "instagram", "title": "Instagram", "url": "https://instagram.com", "description": "Form checks & client wins"},
            {"platform": "whatsapp", "title": "Coaching WhatsApp", "url": "https://wa.me/10000000000", "description": "Book a free consult"},
            {"platform": "youtube", "title": "YouTube", "url": "https://youtube.com", "description": "15-min home workouts"},
        ],
        "gallery": [],
        "chatbot": {"enabled": False, "name": "AI Twin", "tone": "professional", "greeting": "Hey!", "boundaries": [], "instructions": ""},
        "qa": [], "pending": [], "views": 90, "clicks": 20,
    },
    {
        "email": "kai@mosaic.app",
        "username": "kai",
        "name": "Kai Tanaka",
        "bio": "Street photographer chasing neon rain. Film never died. Prints in bio.",
        "location": "Tokyo, Japan",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=srgb&fm=jpg&q=85",
        "cover_url": "https://images.unsplash.com/photo-1542051841857-5f90047e17c9?w=1600&q=80",
        "interests": ["Photography", "Film", "Street Fashion", "Jazz"],
        "daily_question": "",
        "plan": "creator",
        "theme": "luxe", "accent": "#FACC15", "font": "playfair",
        "music": [{"title": "Blue in Green", "artist": "Miles Davis", "url": "https://open.spotify.com/search/Blue%20in%20Green"}],
        "links": [
            {"platform": "instagram", "title": "Instagram", "url": "https://instagram.com", "description": "Shinjuku after midnight"},
            {"platform": "custom", "title": "Print shop", "url": "https://shop.example.com", "description": "Limited-run silver gelatin prints", "thumbnail_url": "https://images.unsplash.com/photo-1542051841857-5f90047e17c9?w=800&q=80"},
        ],
        "gallery": [
            {"url": "https://images.unsplash.com/photo-1542051841857-5f90047e17c9?w=800&q=80", "caption": "Rain on the Yamanote line"},
            {"url": "https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=800&q=80", "caption": "Vending machine glow"},
        ],
        "chatbot": {"enabled": True, "name": "Kai's Twin", "tone": "whimsical", "greeting": "Welcome, night-walker. Ask me about the streets I photograph.", "boundaries": [], "instructions": ""},
        "qa": [], "pending": [], "views": 60, "clicks": 15,
    },
]


async def seed():
    print("Seeding AURA demo data…")
    for c in ("users", "sessions", "links", "gallery", "messages", "polls",
              "poll_votes", "follows", "events", "chat_messages", "status_checks"):
        await db[c].delete_many({})

    pw_hash = hash_pw("mosaic123")
    simran_id = ""
    all_ids = []

    for spec in CREATORS:
        user = User(
            email=spec["email"],
            password_hash=pw_hash,
            username=spec["username"],
            name=spec["name"],
            bio=spec["bio"],
            location=spec["location"],
            avatar_url=spec["avatar_url"],
            cover_url=spec["cover_url"],
            interests=spec["interests"],
            daily_question=spec["daily_question"],
            music=[MusicTrack(**m) for m in spec["music"]],
            appearance=Appearance(
                theme=spec["theme"], accent=spec["accent"], font=spec["font"],
                glass=3 if spec["plan"] != "free" else 2,
            ),
            chatbot=ChatbotSettings(**spec["chatbot"]),
            leaderboard_visible=spec.get("leaderboard_visible", False),
            plan=spec["plan"],
        )
        await db.users.insert_one(user.model_dump())
        all_ids.append(user.id)
        if spec["username"] == "simran":
            simran_id = user.id

        for i, l in enumerate(spec["links"]):
            link = Link(
                user_id=user.id, platform=l.get("platform", "custom"),
                title=l["title"], url=l["url"],
                description=l.get("description", ""),
                thumbnail_url=l.get("thumbnail_url", ""),
                sort_order=i, clicks=(5 - i) * 7,
            )
            await db.links.insert_one(link.model_dump())

        for g in spec["gallery"]:
            item = GalleryItem(user_id=user.id, url=g["url"], caption=g["caption"])
            await db.gallery.insert_one(item.model_dump())

        for qa in spec["qa"]:
            msg = Message(
                recipient_id=user.id, recipient_username=spec["username"],
                content=qa["content"], sender_name="A visitor",
                status="published", answer=qa["answer"],
                created_at=utcnow() - timedelta(days=3),
            )
            await db.messages.insert_one(msg.model_dump())

        for p in spec["pending"]:
            msg = Message(
                recipient_id=user.id, recipient_username=spec["username"],
                content=p["content"], sender_name=p.get("sender_name", "Anonymous"),
                visitor_id="seed-" + str(uuid.uuid4())[:8],
                created_at=utcnow() - timedelta(hours=2),
            )
            await db.messages.insert_one(msg.model_dump())

        # analytics events spread over the past 14 days
        events = []
        for day in range(14):
            n_views = max(1, int(spec["views"] / 14 * (0.5 + (day % 5) / 5)))
            for _ in range(n_views):
                events.append(
                    {"id": str(uuid.uuid4()), "user_id": user.id, "type": "profile_view",
                     "meta": {}, "created_at": utcnow() - timedelta(days=day, hours=(day * 3) % 24)}
                )
            n_clicks = max(0, int(spec["clicks"] / 14 * (0.5 + (day % 4) / 4)))
            for _ in range(n_clicks):
                events.append(
                    {"id": str(uuid.uuid4()), "user_id": user.id, "type": "link_click",
                     "meta": {}, "created_at": utcnow() - timedelta(days=day, hours=(day * 5) % 24)}
                )
        if events:
            await db.events.insert_many(events)

    # Simran's active poll
    poll = Poll(
        user_id=simran_id,
        question="Choose my next little adventure",
        options=[
            PollOption(text="New cafe", votes=14),
            PollOption(text="Thrift finds", votes=9),
            PollOption(text="A slow day out", votes=6),
        ],
    )
    await db.polls.insert_one(poll.model_dump())
    vote_docs = []
    for option in poll.options:
        for index in range(option.votes):
            vote_docs.append({
                "id": str(uuid.uuid4()),
                "poll_id": poll.id,
                "option_id": option.id,
                "voter_id": f"seed-{option.id}-{index}",
                "created_at": utcnow(),
            })
    if vote_docs:
        await db.poll_votes.insert_many(vote_docs)

    # follows between demo creators
    pairs = [(0, 1), (0, 2), (1, 0), (2, 0), (3, 0), (4, 0), (1, 4), (4, 1)]
    for a, b in pairs:
        await db.follows.insert_one(
            {"id": str(uuid.uuid4()), "follower_id": all_ids[a], "target_id": all_ids[b],
             "created_at": utcnow()}
        )

    await ensure_indexes()
    print(f"Done. {len(CREATORS)} creators seeded. Login: simran@aura.app / mosaic123")


if __name__ == "__main__":
    asyncio.run(seed())
