"""Link cards — CRUD for the owner, click tracking for visitors."""

import os
import uuid
from io import BytesIO
from mimetypes import guess_type
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from gridfs.errors import NoFile
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from pymongo import ASCENDING

from lib.db import db
from lib.plans import limits_for
from lib.session import get_current_user
from models.models import Link, LinkCreate, LinkUpdate, User, utcnow

router = APIRouter()
UPLOAD_DIR = Path(
    os.environ.get("AURA_UPLOAD_DIR", Path(__file__).resolve().parents[1] / "uploads")
)
MEDIA_BUCKET = AsyncIOMotorGridFSBucket(db, bucket_name="uploads")
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 25 * 1024 * 1024
ALLOWED_MEDIA_EXTENSIONS = {"jpg", "png", "gif", "webp", "mp4", "webm", "mov", "m4v"}


def media_extension(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "webp"
    if content.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm"
    if len(content) >= 12 and content[4:8] == b"ftyp":
        return "mov" if content[8:12] == b"qt  " else "mp4"
    return None


@router.post("/me/uploads/images")
@router.post("/me/uploads/media")
async def upload_media(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    content = await file.read(MAX_VIDEO_BYTES + 1)
    extension = media_extension(content)
    if extension is None:
        raise HTTPException(
            status_code=415,
            detail="Use a JPEG, PNG, GIF, WebP, MP4, WebM, or MOV file",
        )
    max_bytes = MAX_VIDEO_BYTES if extension in {"mp4", "webm", "mov", "m4v"} else MAX_IMAGE_BYTES
    if len(content) > max_bytes:
        limit_mb = max_bytes // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"Files must be {limit_mb} MB or smaller")

    filename = f"{uuid.uuid4().hex}.{extension}"
    await MEDIA_BUCKET.upload_from_stream_with_id(
        filename.rsplit(".", 1)[0],
        filename,
        BytesIO(content),
        metadata={"content_type": guess_type(filename)[0] or "application/octet-stream"},
    )
    return {"url": f"/api/uploads/{filename}"}


@router.get("/uploads/{filename}")
async def get_uploaded_media(filename: str):
    if not filename or len(filename) > 40 or filename.rsplit(".", 1)[-1] not in ALLOWED_MEDIA_EXTENSIONS:
        raise HTTPException(status_code=404, detail="Media not found")
    stem = filename.rsplit(".", 1)[0]
    if len(stem) != 32 or any(char not in "0123456789abcdef" for char in stem):
        raise HTTPException(status_code=404, detail="Media not found")
    try:
        media = await MEDIA_BUCKET.open_download_stream(stem)
    except NoFile:
        path = UPLOAD_DIR / filename
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Media not found") from None
        return FileResponse(path, headers={"Cache-Control": "public, max-age=31536000, immutable"})

    content_type = (media.metadata or {}).get(
        "content_type",
        guess_type(filename)[0] or "application/octet-stream",
    )
    return Response(
        content=await media.read(),
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.get("/me/links", response_model=list[Link])
async def my_links(user: User = Depends(get_current_user)):
    docs = await db.links.find({"user_id": user.id}).sort("sort_order", ASCENDING).to_list(200)
    return [Link(**d) for d in docs]


@router.post("/me/links", response_model=Link)
async def create_link(input: LinkCreate, user: User = Depends(get_current_user)):
    limits = limits_for(user.plan)
    count = await db.links.count_documents({"user_id": user.id})
    if count >= limits["links"]:
        raise HTTPException(
            status_code=403,
            detail=f"A profile can have up to {limits['links']} links.",
        )
    url = input.url.strip()
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    max_order = await db.links.find_one(
        {"user_id": user.id}, sort=[("sort_order", -1)]
    )
    link = Link(
        user_id=user.id,
        platform=input.platform,
        title=input.title.strip()[:60],
        url=url[:500],
        description=input.description.strip()[:140],
        thumbnail_url=input.thumbnail_url.strip()[:500],
        icon_url=input.icon_url.strip()[:500],
        sort_order=(max_order["sort_order"] + 1) if max_order else 0,
    )
    await db.links.insert_one(link.model_dump())
    return link


@router.patch("/me/links/{link_id}", response_model=Link)
async def update_link(link_id: str, input: LinkUpdate, user: User = Depends(get_current_user)):
    doc = await db.links.find_one({"id": link_id, "user_id": user.id})
    if not doc:
        raise HTTPException(status_code=404, detail="Link not found")
    updates = {k: v for k, v in input.model_dump().items() if v is not None}
    if updates:
        await db.links.update_one({"id": link_id}, {"$set": updates})
    fresh = await db.links.find_one({"id": link_id})
    return Link(**fresh)


@router.delete("/me/links/{link_id}", status_code=204)
async def delete_link(link_id: str, user: User = Depends(get_current_user)):
    await db.links.delete_one({"id": link_id, "user_id": user.id})
    return None


@router.post("/u/{username}/links/{link_id}/click")
async def track_click(username: str, link_id: str):
    doc = await db.users.find_one({"username": username.lower()})
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    link = await db.links.find_one({"id": link_id, "user_id": doc["id"]})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.links.update_one({"id": link_id}, {"$inc": {"clicks": 1}})
    await db.events.insert_one(
        {"id": str(uuid.uuid4()), "user_id": doc["id"], "type": "link_click",
         "meta": {"link_id": link_id}, "created_at": utcnow()}
    )
    return {"ok": True}
