from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from typing import List, Optional, Dict
import uuid

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User, UserList, Place, PlaceRead, ListPrivacy
from src.modules.auth.dependencies import get_current_user
from src.modules.places.service import get_or_create_place_from_url

router = APIRouter(prefix="/api/lists", tags=["Lists"])

# --- Models ---
from pydantic import BaseModel, Field

class UserListCreate(BaseModel):
    name: str
    description: Optional[str] = None
    privacy: ListPrivacy = Field(default=ListPrivacy.PUBLIC)

class UserListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    privacy: Optional[ListPrivacy] = None

class UserListRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    privacy: ListPrivacy
    item_count: int
    # We might want thumbnail images from the first few places

class ListPlaceItem(BaseModel):
    place: PlaceRead
    suggested_dishes: List[str] = []

class UserListDetail(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    privacy: ListPrivacy
    items: List[ListPlaceItem]

class AddPlaceRequest(BaseModel):
    url: str # Google Maps URL
    suggested_dishes: List[str] = []

class AddDishRequest(BaseModel):
    dish_name: str

# --- Endpoints ---

@router.get("", response_model=List[UserListRead])
async def get_my_lists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    stmt = select(UserList).where(UserList.user_id == current_user.id).order_by(UserList.updated_at.desc())
    result = await db.execute(stmt)
    lists = result.scalars().all()
    
    return [
        UserListRead(
            id=l.id,
            name=l.name,
            description=l.description,
            privacy=l.privacy,
            item_count=len(l.items)
        ) for l in lists
    ]

@router.post("", response_model=UserListRead)
async def create_list(
    payload: UserListCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    new_list = UserList(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        privacy=payload.privacy,
        items=[]
    )
    db.add(new_list)
    await db.commit()
    await db.refresh(new_list)
    
    return UserListRead(
        id=new_list.id,
        name=new_list.name,
        description=new_list.description,
        privacy=new_list.privacy,
        item_count=0
    )

@router.patch("/{list_id}", response_model=UserListRead)
async def update_list(
    list_id: uuid.UUID,
    payload: UserListUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    stmt = select(UserList).where(UserList.id == list_id, UserList.user_id == current_user.id)
    result = await db.execute(stmt)
    user_list = result.scalar_one_or_none()
    
    if not user_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    if payload.name is not None:
        user_list.name = payload.name
    if payload.description is not None:
        user_list.description = payload.description
    if payload.privacy is not None:
        user_list.privacy = payload.privacy
        
    await db.commit()
    await db.refresh(user_list)
    
    return UserListRead(
        id=user_list.id,
        name=user_list.name,
        description=user_list.description,
        privacy=user_list.privacy,
        item_count=len(user_list.items)
    )

@router.get("/{list_id}", response_model=UserListDetail)
async def get_list_detail(
    list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    stmt = select(UserList).where(UserList.id == list_id, UserList.user_id == current_user.id)
    result = await db.execute(stmt)
    user_list = result.scalar_one_or_none()
    
    if not user_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    # Hydrate places
    # items = [{"place_id": str, "suggested_dishes": []}, ...]
    place_ids = [uuid.UUID(item["place_id"]) for item in user_list.items]
    
    if not place_ids:
        return UserListDetail(
            id=user_list.id,
            name=user_list.name,
            description=user_list.description,
            privacy=user_list.privacy,
            items=[]
        )
        
    stmt_places = select(Place).where(Place.id.in_(place_ids))
    result_places = await db.execute(stmt_places)
    places_map = {p.id: p for p in result_places.scalars().all()}
    
    detail_items = []
    for item in user_list.items:
        p_id = uuid.UUID(item["place_id"])
        if p_id in places_map:
            place_obj = places_map[p_id]
            detail_items.append(
                ListPlaceItem(
                    place=PlaceRead.model_validate(place_obj),
                    suggested_dishes=item.get("suggested_dishes", [])
                )
            )
            
    return UserListDetail(
        id=user_list.id,
        name=user_list.name,
        description=user_list.description,
        privacy=user_list.privacy,
        items=detail_items
    )

@router.post("/{list_id}/add", response_model=UserListDetail)
async def add_place_to_list(
    list_id: uuid.UUID,
    payload: AddPlaceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    stmt = select(UserList).where(UserList.id == list_id, UserList.user_id == current_user.id)
    result = await db.execute(stmt)
    user_list = result.scalar_one_or_none()
    
    if not user_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    # Get or create place
    try:
        place, _, _ = await get_or_create_place_from_url(db, payload.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    # Check if already in list
    place_id_str = str(place.id)
    for item in user_list.items:
        if item["place_id"] == place_id_str:
            raise HTTPException(status_code=400, detail="Place already in list")
            
    # Add to list
    # We need to re-assign user_list.items because it's a JSONB field mutation check
    new_item = {
        "place_id": place_id_str,
        "suggested_dishes": payload.suggested_dishes
    }
    
    # SQLAlchemy requires flagging modification for JSON mutable
    # Or just re-assigning the list
    new_items = list(user_list.items)
    new_items.append(new_item)
    user_list.items = new_items
    
    # flag modified just in case
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user_list, "items")
    
    await db.commit()
    await db.refresh(user_list)
    
    # Return updated detail (recurse to get_list_detail logic essentially)
    # For simplicity, let's just call get_list_detail or reconstruct
    return await get_list_detail(list_id, current_user, db)


@router.post("/{list_id}/items/{place_id}/dish")
async def add_dish_suggestion(
    list_id: uuid.UUID,
    place_id: str,
    payload: AddDishRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    stmt = select(UserList).where(UserList.id == list_id, UserList.user_id == current_user.id)
    result = await db.execute(stmt)
    user_list = result.scalar_one_or_none()
    
    if not user_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    # Find item
    found = False
    new_items = list(user_list.items)
    for item in new_items:
        if item["place_id"] == place_id:
            dishes = item.get("suggested_dishes", [])
            if payload.dish_name not in dishes:
                dishes.append(payload.dish_name)
                item["suggested_dishes"] = dishes
            found = True
            break
            
    if not found:
        raise HTTPException(status_code=404, detail="Place not found in list")
        
    user_list.items = new_items
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user_list, "items")
    
    await db.commit()
    return {"status": "ok", "suggested_dishes": item["suggested_dishes"]}

@router.delete("/{list_id}")
async def delete_list(
    list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    stmt = select(UserList).where(UserList.id == list_id, UserList.user_id == current_user.id)
    result = await db.execute(stmt)
    user_list = result.scalar_one_or_none()
    
    if not user_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    await db.delete(user_list)
    await db.commit()
    return {"status": "deleted"}

@router.delete("/{list_id}/items/{place_id}")
async def remove_item_from_list(
    list_id: uuid.UUID,
    place_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    stmt = select(UserList).where(UserList.id == list_id, UserList.user_id == current_user.id)
    result = await db.execute(stmt)
    user_list = result.scalar_one_or_none()
    
    if not user_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    new_items = [i for i in user_list.items if i["place_id"] != place_id]
    
    if len(new_items) == len(user_list.items):
        raise HTTPException(status_code=404, detail="Item not in list")
        
    user_list.items = new_items
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user_list, "items")
    
    await db.commit()
    return {"status": "removed"}
