from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from typing import List, Optional, Dict
import uuid

from src.core.database.postgres import get_db_session
from src.core.database.sql_models import User, UserList, Place, PlaceRead, ListPrivacy, UserListFollow
from src.modules.auth.dependencies import get_current_user, get_optional_current_user
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
    followers_count: int = 0
    items: List[Dict] = []
    is_owner: bool = True
    is_following: bool = False
    owner_username: Optional[str] = None

class ListPlaceItem(BaseModel):
    place: PlaceRead
    suggested_dishes: List[str] = []

class UserListDetail(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: Optional[str]
    privacy: ListPrivacy
    items: List[ListPlaceItem]
    is_owner: bool = False
    is_following: bool = False
    followers_count: int = 0
    owner_username: Optional[str] = None

class AddPlaceRequest(BaseModel):
    url: str # Google Maps URL
    suggested_dishes: List[str] = []

class AddDishRequest(BaseModel):
    dish_name: str

# --- Endpoints ---

@router.get("/discover", response_model=List[UserListRead])
async def discover_public_lists(
    skip: int = 0,
    limit: int = 20,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Discover public lists from all users, sorted by follower count."""
    from sqlalchemy import func
    from sqlalchemy.orm import joinedload

    # Base query: public lists only
    stmt = (
        select(UserList)
        .options(joinedload(UserList.user))
        .where(UserList.privacy == ListPrivacy.PUBLIC)
    )

    # Exclude current user's own lists if authenticated
    if current_user:
        stmt = stmt.where(UserList.user_id != current_user.id)

    # Subquery for follower count ordering
    followers_subq = (
        select(
            UserListFollow.list_id,
            func.count(UserListFollow.user_id).label("fc")
        )
        .group_by(UserListFollow.list_id)
        .subquery()
    )

    stmt = (
        stmt
        .outerjoin(followers_subq, UserList.id == followers_subq.c.list_id)
        .order_by(func.coalesce(followers_subq.c.fc, 0).desc(), UserList.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)
    public_lists = result.scalars().unique().all()

    # Get follower counts
    list_ids = [l.id for l in public_lists]
    followers_counts = {}
    if list_ids:
        stmt_count = (
            select(UserListFollow.list_id, func.count(UserListFollow.user_id))
            .where(UserListFollow.list_id.in_(list_ids))
            .group_by(UserListFollow.list_id)
        )
        result_count = await db.execute(stmt_count)
        for lid, count in result_count.all():
            followers_counts[lid] = count

    # Check if current user follows any
    following_ids = set()
    if current_user:
        stmt_follows = select(UserListFollow.list_id).where(
            UserListFollow.user_id == current_user.id,
            UserListFollow.list_id.in_(list_ids)
        )
        res_follows = await db.execute(stmt_follows)
        following_ids = {row[0] for row in res_follows.all()}

    results = []
    for l in public_lists:
        results.append(UserListRead(
            id=l.id,
            name=l.name,
            description=l.description,
            privacy=l.privacy,
            item_count=len(l.items),
            followers_count=followers_counts.get(l.id, 0),
            items=[],
            is_owner=False,
            is_following=l.id in following_ids,
            owner_username=l.user.username if l.user else None
        ))

    return results


@router.get("", response_model=List[UserListRead])
async def get_my_lists(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    # 1. Fetch owned lists with owner info (owner is current_user)
    stmt_owned = select(UserList).where(UserList.user_id == current_user.id).order_by(UserList.updated_at.desc())
    res_owned = await db.execute(stmt_owned)
    owned_lists = res_owned.scalars().all()
    
    # 2. Fetch followed lists with owner info
    from sqlalchemy.orm import joinedload
    stmt_followed = (
        select(UserList)
        .options(joinedload(UserList.user))
        .join(UserListFollow, UserListFollow.list_id == UserList.id)
        .where(UserListFollow.user_id == current_user.id)
        .order_by(UserList.updated_at.desc())
    )
    res_followed = await db.execute(stmt_followed)
    followed_lists = res_followed.scalars().all()
    
    # 3. Combine list IDs for followers count
    all_lists = owned_lists + followed_lists
    list_ids = [l.id for l in all_lists]
    followers_counts = {}
    if list_ids:
        from sqlalchemy import func
        stmt_count = (
            select(UserListFollow.list_id, func.count(UserListFollow.user_id))
            .where(UserListFollow.list_id.in_(list_ids))
            .group_by(UserListFollow.list_id)
        )
        result_count = await db.execute(stmt_count)
        for lid, count in result_count.all():
            followers_counts[lid] = count

    # 4. Map to response model
    results = []
    
    # Add owned
    owned_ids = set()
    for l in owned_lists:
        owned_ids.add(l.id)
        results.append(UserListRead(
            id=l.id,
            name=l.name,
            description=l.description,
            privacy=l.privacy,
            item_count=len(l.items),
            followers_count=followers_counts.get(l.id, 0),
            items=l.items,
            is_owner=True,
            is_following=False,
            owner_username=current_user.username
        ))
        
    # Add followed
    for l in followed_lists:
        if l.id in owned_ids: continue # Should not happen based on follow logic
        results.append(UserListRead(
            id=l.id,
            name=l.name,
            description=l.description,
            privacy=l.privacy,
            item_count=len(l.items),
            followers_count=followers_counts.get(l.id, 0),
            items=l.items,
            is_owner=False,
            is_following=True,
            owner_username=l.user.username if l.user else None
        ))

    return results

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
        item_count=0,
        followers_count=0
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
        item_count=len(user_list.items),
        # simplified for update return
        followers_count=0 
    )

@router.get("/{list_id}", response_model=UserListDetail)
async def get_list_detail(
    list_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    # Fetch list by ID with joined user
    from sqlalchemy.orm import joinedload
    stmt = select(UserList).options(joinedload(UserList.user)).where(UserList.id == list_id)
    result = await db.execute(stmt)
    user_list = result.scalar_one_or_none()
    
    if not user_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    # Check Privacy
    is_owner = current_user and user_list.user_id == current_user.id
    if user_list.privacy == ListPrivacy.PRIVATE and not is_owner:
         raise HTTPException(status_code=404, detail="List not found or private")
        
    # Calculate counts and status
    is_owner = False
    if current_user:
        is_owner = str(user_list.user_id) == str(current_user.id)
    
    is_following = False
    if current_user:
        stmt_follow = select(UserListFollow).where(
            UserListFollow.user_id == current_user.id,
            UserListFollow.list_id == list_id
        )
        res_follow = await db.execute(stmt_follow)
        if res_follow.scalar_one_or_none():
            is_following = True

    from sqlalchemy import func
    stmt_count = select(func.count(UserListFollow.user_id)).where(UserListFollow.list_id == list_id)
    res_count = await db.execute(stmt_count)
    followers_count = res_count.scalar() or 0

    # Hydrate places
    detail_items = []
    place_ids = [uuid.UUID(item["place_id"]) for item in user_list.items]
    
    if place_ids:
        stmt_places = select(Place).where(Place.id.in_(place_ids))
        result_places = await db.execute(stmt_places)
        places_map = {p.id: p for p in result_places.scalars().all()}
        
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
        user_id=user_list.user_id,
        name=user_list.name,
        description=user_list.description,
        privacy=user_list.privacy,
        items=detail_items,
        is_owner=is_owner,
        is_following=is_following,
        followers_count=followers_count,
        owner_username=user_list.user.username if user_list.user else None
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
        place, _, _ = await get_or_create_place_from_url(db, payload.url, user_id=current_user.id)
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
    
@router.post("/{list_id}/follow")
async def follow_list(
    list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    # Check if list exists
    stmt = select(UserList).where(UserList.id == list_id)
    result = await db.execute(stmt)
    user_list = result.scalar_one_or_none()
    
    if not user_list:
        raise HTTPException(status_code=404, detail="List not found")
        
    if user_list.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow your own list")
        
    # Check if already following
    stmt_check = select(UserListFollow).where(
        UserListFollow.user_id == current_user.id,
        UserListFollow.list_id == list_id
    )
    result_check = await db.execute(stmt_check)
    if result_check.scalar_one_or_none():
         raise HTTPException(status_code=400, detail="Already following")
         
    follow = UserListFollow(user_id=current_user.id, list_id=list_id)
    db.add(follow)
    await db.commit()
    return {"status": "followed"}

@router.delete("/{list_id}/follow")
async def unfollow_list(
    list_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    stmt = select(UserListFollow).where(
        UserListFollow.user_id == current_user.id,
        UserListFollow.list_id == list_id
    )
    result = await db.execute(stmt)
    follow = result.scalar_one_or_none()
    
    if not follow:
        raise HTTPException(status_code=404, detail="Not following")
        
    await db.delete(follow)
    await db.commit()
    return {"status": "unfollowed"}
