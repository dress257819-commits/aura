from io import BytesIO
from pathlib import Path

import pytest
from fastapi import HTTPException, UploadFile
from gridfs.errors import NoFile

from models.models import User
from routers import links


class FakeMedia:
    def __init__(self, content: bytes, metadata: dict | None = None):
        self.content = content
        self.metadata = metadata or {}

    async def read(self):
        return self.content


class FakeMediaBucket:
    def __init__(self):
        self.files: dict[str, FakeMedia] = {}

    async def upload_from_stream_with_id(
        self, file_id, filename, source, metadata=None
    ):
        self.files[file_id] = FakeMedia(
            source.read(),
            {"filename": filename, **(metadata or {})},
        )

    async def open_download_stream(self, file_id):
        if file_id not in self.files:
            raise NoFile("Media not found")
        return self.files[file_id]


def upload_user() -> User:
    return User(
        id="media-owner",
        email="media@example.com",
        username="mediaowner",
        name="Media Owner",
    )


async def test_uploaded_media_is_stored_in_mongodb_and_served_from_gridfs(monkeypatch):
    bucket = FakeMediaBucket()
    monkeypatch.setattr(links, "MEDIA_BUCKET", bucket)
    content = b"\x89PNG\r\n\x1a\nAURA image"
    upload = UploadFile(filename="portrait.png", file=BytesIO(content))

    result = await links.upload_media(upload, upload_user())
    filename = result["url"].rsplit("/", 1)[-1]
    media = await links.get_uploaded_media(filename)

    assert filename.endswith(".png")
    assert next(iter(bucket.files.values())).content == content
    assert media.body == content
    assert media.media_type == "image/png"
    assert media.headers["cache-control"] == "public, max-age=31536000, immutable"


async def test_missing_gridfs_media_returns_not_found(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(links, "MEDIA_BUCKET", FakeMediaBucket())
    monkeypatch.setattr(links, "UPLOAD_DIR", tmp_path)
    filename = "0123456789abcdef0123456789abcdef.png"

    with pytest.raises(HTTPException) as error:
        await links.get_uploaded_media(filename)

    assert error.value.status_code == 404
