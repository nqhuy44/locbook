from beanie import Document
from pydantic import Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import pymongo

class Place(Document):
    name: str = Field(..., description="Name of the place")
    address: Optional[str] = None
    location: Optional[Dict[str, Any]] = Field(None, description="GeoJSON Point {type: 'Point', coordinates: [lon, lat]}")
    categories: List[str] = Field(default_factory=list, description="List of simple categories (e.g. Cafe, Bar)")
    meal_types: List[str] = Field(default_factory=list, description="Breakfast, Lunch, Dinner, Brunch, Late Night")
    occasions: List[str] = Field(default_factory=list, description="Date, Work, Group, Solo, Business")
    vibes: List[str] = Field(default_factory=list)
    mood: List[str] = Field(default_factory=list)
    aesthetic_score: Optional[int] = None
    lighting: Optional[str] = None
    # marin_comment: removed (generated dynamically)
    google_maps_url: Optional[str] = None
    rating: Optional[float] = None
    price_level: Optional[str] = None
    status: Optional[str] = None # Operational, Closed, etc.
    # OPENING_HOURS removed
    opening_hours: Optional[str] = Field(None, description="Opening hours description")
    popular_times: Optional[str] = Field(None, description="Popular times summary")
    source_img_id: Optional[str] = None
    local_image_path: Optional[str] = Field(None, description="Path to locally stored image")
    
    # Future-proofing
    raw_ai_response: Optional[Dict[str, Any]] = Field(None, description="Raw JSON from AI for re-parsing")
    schema_version: int = Field(default=1, description="Schema version for migration")
    
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Settings:
        name = "places"
        indexes = [
            [("name", pymongo.TEXT), ("categories", pymongo.TEXT), ("meal_types", pymongo.TEXT), ("occasions", pymongo.TEXT)] # Text Index
        ]

class PlaceSummary(BaseModel):
    id: PydanticObjectId = Field(alias="_id")
    name: str
    address: Optional[str] = None
    categories: List[str] = Field(default_factory=list)
    vibes: List[str] = Field(default_factory=list)
    mood: List[str] = Field(default_factory=list)
    aesthetic_score: Optional[int] = None
    rating: Optional[float] = None
    price_level: Optional[str] = None
    local_image_path: Optional[str] = None
    google_maps_url: Optional[str] = None
    
    class Settings:
        projection = {"raw_ai_response": 0}

class UserLog(Document):
    user_id: int
    username: Optional[str] = None
    action: str
    target_id: Optional[str] = None # Place ID or other
    created_at: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "user_logs"
