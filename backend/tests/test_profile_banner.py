import pytest
from fastapi import HTTPException

from lib.plans import effective_plan
from models.models import User
from routers.profiles import ProfileUpdate, update_profile


class FakeUsers:
    def __init__(self, user: User):
        self.document = user.model_dump()

    async def update_one(self, query, update):
        assert query == {"id": self.document["id"]}
        self.document.update(update["$set"])

    async def find_one(self, query):
        assert query == {"id": self.document["id"]}
        return self.document


class FakeDatabase:
    def __init__(self, user: User):
        self.users = FakeUsers(user)


def make_user(plan: str, cover_url: str = "") -> User:
    return User(
        id=f"{plan}-user",
        email=f"{plan}@example.com",
        username=f"{plan}user",
        name="Profile owner",
        plan=plan,
        cover_url=cover_url,
    )


@pytest.mark.parametrize("plan", ["pro", "creator"])
async def test_paid_users_can_set_profile_banner(monkeypatch, plan):
    monkeypatch.setenv("AURA_FREE_ACCESS_END", "2026-01-01T00:00:00Z")
    user = make_user(plan)
    monkeypatch.setattr("routers.profiles.db", FakeDatabase(user))

    updated = await update_profile(ProfileUpdate(cover_url="https://example.com/banner.jpg"), user)

    assert updated.cover_url == "https://example.com/banner.jpg"


async def test_free_user_can_set_profile_banner_during_promotion(monkeypatch):
    monkeypatch.setenv("AURA_FREE_ACCESS_END", "2026-12-01T16:36:13Z")
    user = make_user("free")
    user.plan = effective_plan(user.model_dump())
    monkeypatch.setattr("routers.profiles.db", FakeDatabase(user))

    updated = await update_profile(ProfileUpdate(cover_url="https://example.com/banner.jpg"), user)

    assert updated.cover_url == "https://example.com/banner.jpg"


async def test_free_user_cannot_add_profile_banner_after_promotion(monkeypatch):
    monkeypatch.setenv("AURA_FREE_ACCESS_END", "2026-01-01T00:00:00Z")
    user = make_user("free")
    monkeypatch.setattr("routers.profiles.db", FakeDatabase(user))

    with pytest.raises(HTTPException) as error:
        await update_profile(ProfileUpdate(cover_url="https://example.com/banner.jpg"), user)

    assert error.value.status_code == 403


async def test_free_user_can_remove_existing_profile_banner(monkeypatch):
    user = make_user("free", cover_url="https://example.com/old-banner.jpg")
    monkeypatch.setattr("routers.profiles.db", FakeDatabase(user))

    updated = await update_profile(ProfileUpdate(cover_url=""), user)

    assert updated.cover_url == ""