"""Menu API router — OCR extraction and CRUD for Place menu items."""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import uuid

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import Place, MenuItem
from src.core.llm import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/places", tags=["Menu"])


class MenuItemUpdate(BaseModel):
    name: str
    description: Optional[str] = None
    price: Optional[int] = None
    display_price: Optional[str] = None
    image_url: Optional[str] = None
    is_signature: bool = False
    category: Optional[str] = None


@router.get("/{place_id}/menu")
async def get_menu(
    place_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Get menu items for a place."""
    try:
        place_uuid = uuid.UUID(place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    place = await db.get(Place, place_uuid)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    return {
        "place_id": str(place.id),
        "place_name": place.name,
        "menu": place.menu or [],
        "total": len(place.menu) if place.menu else 0,
    }


@router.put("/{place_id}/menu")
async def update_menu(
    place_id: str,
    items: List[MenuItemUpdate],
    db: AsyncSession = Depends(get_db_session),
):
    """Replace menu for a place (Admin)."""
    try:
        place_uuid = uuid.UUID(place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    place = await db.get(Place, place_uuid)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    # Convert Pydantic models to dicts for JSONB storage
    place.menu = [item.model_dump() for item in items]
    await db.commit()
    await db.refresh(place)

    return {
        "status": "ok",
        "place_id": str(place.id),
        "menu": place.menu,
        "total": len(place.menu),
    }


@router.post("/{place_id}/menu/ocr")
async def extract_menu_from_images(
    place_id: str,
    files: List[UploadFile] = File(...),
    save: bool = True,
    db: AsyncSession = Depends(get_db_session),
):
    """Extract menu items from uploaded menu image(s) via Gemini Vision OCR.
    
    Args:
        place_id: Place UUID
        files: Menu image files (max 5)
        save: If True, save extracted items to Place.menu (append)
    """
    try:
        place_uuid = uuid.UUID(place_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    place = await db.get(Place, place_uuid)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Max 5 images per request")

    # Read images
    images = []
    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not an image")
        content = await file.read()
        images.append((content, file.content_type))

    # OCR via Gemini Vision
    result = await ai_service.extract_menu(images)

    if "error" in result and not result.get("items"):
        raise HTTPException(status_code=500, detail=result["error"])

    extracted_items = result.get("items", [])

    # Save if requested
    if save and extracted_items:
        existing_menu = place.menu or []
        # Deduplicate by name
        existing_names = {item.get("name", "").lower() for item in existing_menu}
        new_items = [
            item for item in extracted_items 
            if item.get("name", "").lower() not in existing_names
        ]
        place.menu = existing_menu + new_items
        await db.commit()
        await db.refresh(place)

    return {
        "status": "ok",
        "place_id": str(place.id),
        "extracted": extracted_items,
        "total_extracted": len(extracted_items),
        "saved": save,
        "menu": place.menu if save else None,
    }
