import pytest
from fastapi import HTTPException

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


async def test_free_user_cannot_add_profile_banner(monkeypatch):
    user = make_user("free")
    monkeypatch.setattr("routers.profiles.db", FakeDatabase(user))

    with pytest.raises(HTTPException) as error:
        await update_profile(ProfileUpdate(cover_url="https://example.com/banner.jpg"), user)

    assert error.value.status_code == 403
    assert "Pro and Creator" in error.value.detail


@pytest.mark.parametrize("plan", ["pro", "creator"])
async def test_premium_user_can_set_profile_banner(monkeypatch, plan):
    user = make_user(plan)
    monkeypatch.setattr("routers.profiles.db", FakeDatabase(user))

    updated = await update_profile(ProfileUpdate(cover_url="https://example.com/banner.jpg"), user)

    assert updated.cover_url == "https://example.com/banner.jpg"


async def test_free_user_can_remove_existing_profile_banner(monkeypatch):
    user = make_user("free", cover_url="https://example.com/old-banner.jpg")
    monkeypatch.setattr("routers.profiles.db", FakeDatabase(user))

    updated = await update_profile(ProfileUpdate(cover_url=""), user)

    assert updated.cover_url == ""