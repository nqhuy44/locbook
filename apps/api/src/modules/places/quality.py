"""Place data quality utilities — sync, re-embed, re-analyze, search-text."""
import logging
from typing import Optional, List
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func as sa_func
from sqlmodel import select

from src.core.database.sql_models import Place
from src.core.ai import get_text_embedding
from src.core.llm import ai_service

logger = logging.getLogger(__name__)


def sync_location(place: Place) -> Place:
    """Sync lat/lon ↔ PostGIS location geometry on save.
    
    If lat/lon are set but location is None, generate the PostGIS point.
    If location is set but lat/lon are None, this is a no-op (PostGIS → lat/lon 
    requires ST_X/ST_Y which needs a DB query).
    """
    if place.latitude is not None and place.longitude is not None:
        place.location = f"SRID=4326;POINT({place.longitude} {place.latitude})"
    return place


def generate_embedding_text(place: Place) -> str:
    """Build a rich text representation of a Place for embedding generation."""
    parts = [place.name]
    if place.address:
        parts.append(place.address)
    if place.categories:
        parts.append(f"Categories: {', '.join(place.categories)}")
    if place.vibes:
        parts.append(f"Vibes: {', '.join(place.vibes)}")
    if place.mood:
        parts.append(f"Mood: {', '.join(place.mood)}")
    if place.price_level:
        parts.append(f"Price: {place.price_level}")
    if place.opening_hours:
        parts.append(f"Hours: {place.opening_hours}")
    return " | ".join(parts)


async def regenerate_embedding(db: AsyncSession, place: Place) -> Place:
    """Re-generate embedding for a Place based on its current data."""
    text = generate_embedding_text(place)
    embedding = await get_text_embedding(text)
    if embedding:
        place.embedding = embedding
        logger.info(f"Regenerated embedding for place {place.id}")
    else:
        logger.warning(f"Failed to regenerate embedding for place {place.id}")
    return place


async def auto_aesthetic_score(place: Place, images: List[tuple[bytes, str]]) -> Place:
    """Auto-compute aesthetic_score via Gemini Vision analysis."""
    if not images:
        return place
    
    result = await ai_service.analyze_aesthetic(images)
    if "error" not in result:
        place.aesthetic_score = result["aesthetic_score"]
        logger.info(f"Auto aesthetic score for {place.id}: {result['aesthetic_score']} — {result.get('reasoning', '')}")
    return place


def build_search_text(place: Place) -> str:
    """Build concatenated plain text for tsvector generation.
    
    Combines name, address, categories, vibes, mood, district, ward, street
    into a single searchable string.
    """
    parts = [place.name or ""]
    if place.address:
        parts.append(place.address)
    if place.district:
        parts.append(place.district)
    if place.ward:
        parts.append(place.ward)
    if place.street:
        parts.append(place.street)
    if place.categories:
        parts.append(" ".join(place.categories))
    if place.vibes:
        parts.append(" ".join(place.vibes))
    if place.mood:
        parts.append(" ".join(place.mood))
    return " ".join(parts)


def sync_search_text(place: Place) -> Place:
    """Populate the search_text tsvector column from place metadata.
    
    Uses 'simple' config for language-agnostic tokenization
    (works well with mixed Vietnamese + English text).
    """
    text = build_search_text(place)
    place.search_text = sa_func.to_tsvector('simple', text)
    return place


async def on_place_save(db: AsyncSession, place: Place) -> Place:
    """Hook to run on every Place create/update.
    
    1. Sync lat/lon ↔ PostGIS location
    2. Re-generate embedding
    3. Populate search_text tsvector for FTS
    """
    place = sync_location(place)
    place = await regenerate_embedding(db, place)
    place = sync_search_text(place)
    return place
