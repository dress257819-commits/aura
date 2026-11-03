import pytest

from models.models import User
from routers.auth import me_response
from routers.explore import leaderboard
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


@pytest.mark.parametrize("visible", [True, False])
async def test_profile_explore_visibility_can_be_changed(monkeypatch, visible):
    user = User(
        id="profile-owner",
        email="owner@example.com",
        username="owner",
        name="Profile owner",
    )
    database = FakeDatabase(user)
    monkeypatch.setattr("routers.profiles.db", database)

    updated = await update_profile(ProfileUpdate(explore_visible=visible), user)

    assert updated.explore_visible is visible
    assert database.users.document["explore_visible"] is visible


@pytest.mark.parametrize("visible", [True, False])
async def test_profile_leaderboard_visibility_can_be_changed(monkeypatch, visible):
    user = User(
        id="profile-owner",
        email="owner@example.com",
        username="owner",
        name="Profile owner",
    )
    database = FakeDatabase(user)
    monkeypatch.setattr("routers.profiles.db", database)

    updated = await update_profile(ProfileUpdate(leaderboard_visible=visible), user)

    assert updated.leaderboard_visible is visible
    assert database.users.document["leaderboard_visible"] is visible


def test_authenticated_profile_response_keeps_explore_visibility():
    user = User(
        id="profile-owner",
        email="owner@example.com",
        username="owner",
        name="Profile owner",
        explore_visible=False,
    )

    assert me_response(user).explore_visible is False


async def test_leaderboard_only_queries_profiles_that_opted_in(monkeypatch):
    class EmptyCursor:
        async def to_list(self, length):
            return []

    class FakeLeaderboardUsers:
        def find(self, query, projection):
            assert query == {"leaderboard_visible": True}
            return EmptyCursor()

    class FakeLeaderboardDatabase:
        users = FakeLeaderboardUsers()

    monkeypatch.setattr("routers.explore.db", FakeLeaderboardDatabase())

    result = await leaderboard()

    assert result.entries == []
