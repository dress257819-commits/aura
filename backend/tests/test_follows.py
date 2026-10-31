import pytest
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError
from models.models import User
from routers import explore, profiles


class FakeFollowCollection:
    def __init__(self):
        self.documents = []

    async def find_one(self, query):
        return next(
            (
                document
                for document in self.documents
                if all(document.get(key) == value for key, value in query.items())
            ),
            None,
        )

    async def insert_one(self, document):
        self.documents.append(document)

    async def delete_one(self, query):
        self.documents = [
            document
            for document in self.documents
            if not all(document.get(key) == value for key, value in query.items())
        ]

    async def count_documents(self, query):
        return sum(
            all(document.get(key) == value for key, value in query.items())
            for document in self.documents
        )


async def test_follow_toggle_allows_one_relation_per_account_and_creator(monkeypatch):
    collection = FakeFollowCollection()

    class FakeUsers:
        async def find_one(self, query):
            return {"id": "creator-1", "username": "creator"}

    class FakeDatabase:
        follows = collection
        users = FakeUsers()

    monkeypatch.setattr(profiles, "db", FakeDatabase())
    account = User(
        id="follower-1",
        email="follower@example.com",
        username="follower",
        name="Follower",
    )

    followed = await profiles.toggle_follow("creator", account)
    unfollowed = await profiles.toggle_follow("creator", account)

    assert followed == {"following": True, "followers": 1}
    assert unfollowed == {"following": False, "followers": 0}
    assert collection.documents == []


async def test_follow_toggle_does_not_follow_self(monkeypatch):
    class FakeUsers:
        async def find_one(self, query):
            return {"id": "follower-1", "username": "follower"}

    class FakeDatabase:
        follows = FakeFollowCollection()
        users = FakeUsers()

    monkeypatch.setattr(profiles, "db", FakeDatabase())
    account = User(
        id="follower-1",
        email="follower@example.com",
        username="follower",
        name="Follower",
    )

    with pytest.raises(HTTPException) as error:
        await profiles.toggle_follow("follower", account)
    assert error.value.status_code == 422


async def test_follow_toggle_treats_concurrent_duplicate_as_already_following(monkeypatch):
    class RacingFollowCollection(FakeFollowCollection):
        async def insert_one(self, document):
            self.documents.append(document)
            raise DuplicateKeyError("follow pair already exists")

    class FakeUsers:
        async def find_one(self, query):
            return {"id": "creator-1", "username": "creator"}

    class FakeDatabase:
        follows = RacingFollowCollection()
        users = FakeUsers()

    collection = FakeDatabase.follows
    monkeypatch.setattr(profiles, "db", FakeDatabase())
    account = User(
        id="follower-1",
        email="follower@example.com",
        username="follower",
        name="Follower",
    )

    result = await profiles.toggle_follow("creator", account)

    assert result == {"following": True, "followers": 1}
    assert len(collection.documents) == 1


async def test_explore_marks_creators_followed_by_current_account(monkeypatch):
    class FakeCursor:
        def __init__(self, documents):
            self.documents = documents

        async def to_list(self, length):
            return self.documents[:length]

    class FakeUsers:
        def find(self, query):
            return FakeCursor([
                {
                    "id": "creator-1",
                    "username": "creator",
                    "name": "Creator",
                    "avatar_url": "",
                    "bio": "",
                    "interests": [],
                    "plan": "free",
                    "appearance": {},
                }
            ])

    class FakeFollows:
        def find(self, query, projection):
            assert query["follower_id"] == "follower-1"
            return FakeCursor([{"target_id": "creator-1"}])

        async def count_documents(self, query):
            return 1

    class FakeDatabase:
        users = FakeUsers()
        follows = FakeFollows()

    monkeypatch.setattr(explore, "db", FakeDatabase())
    account = User(
        id="follower-1",
        email="follower@example.com",
        username="follower",
        name="Follower",
    )

    cards = await explore.explore(viewer=account)

    assert cards[0]["username"] == "creator"
    assert cards[0]["following"] is True
