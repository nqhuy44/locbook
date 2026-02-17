from datetime import datetime
from typing import List, Optional, Any, Dict
from enum import Enum
import uuid

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import String, Column, DateTime, text, Numeric, Text, ARRAY, Integer, UniqueConstraint, func, Boolean, Enum as SAEnum


from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from geoalchemy2 import Geometry

# ==========================================
# 1. ENUMS & SHARED SCHEMAS
# ==========================================

class InteractionType(str, Enum):
    UPVOTE = "upvote"
    VIEW = "view"
    BOOKMARK = "bookmark"

class Role(str, Enum):
    USER = "user"
    ADMIN = "admin"

class MemoVisibility(str, Enum):
    PUBLIC = "public"       # Hiện trên Place detail, ai cũng thấy
    FOLLOWERS = "followers" # Chỉ người follow mới thấy trên feed
    PRIVATE = "private"     # Chỉ mình user thấy (Nhật ký)

# Schema cho Món ăn (Embedded trong JSONB của Place)
class MenuItem(SQLModel):
    name: str
    description: Optional[str] = None
    price: Optional[int] = None      # Giá trị số để filter (VD: < 50k)
    display_price: Optional[str] = None # Text hiển thị (VD: "45k", "Thời giá")
    image_url: Optional[str] = None
    is_signature: bool = False       # Món Must-try
    category: Optional[str] = None   # Cafe, Bánh, Món chính...

# --- API Response / Request Schemas ---

class PlaceRead(SQLModel):
    """Response schema for Place — excludes PostGIS geometry and vector embedding."""
    id: uuid.UUID
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    ward: Optional[str] = None
    street: Optional[str] = None
    country: Optional[str] = None
    categories: Optional[List[str]] = None
    vibes: Optional[List[str]] = None
    mood: Optional[List[str]] = None
    price_level: Optional[str] = None
    menu: List[MenuItem] = []
    rating: Optional[float] = None
    aesthetic_score: Optional[int] = 0
    upvote_count: int = 0
    memo_count: int = 0
    images: Optional[List[str]] = None
    local_image_path: Optional[str] = None
    google_maps_url: Optional[str] = None
    opening_hours: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    raw_ai_response: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class PlaceUpdate(SQLModel):
    """Partial update schema for Place."""
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    ward: Optional[str] = None
    street: Optional[str] = None
    country: Optional[str] = None
    categories: Optional[List[str]] = None
    vibes: Optional[List[str]] = None
    mood: Optional[List[str]] = None
    price_level: Optional[str] = None
    rating: Optional[float] = None
    google_maps_url: Optional[str] = None
    opening_hours: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# Base Schema cho Place (Dùng chung cho Create/Read)
class PlaceBase(SQLModel):
    name: str
    address: Optional[str] = Field(default=None, sa_column=Column(Text))
    
    # --- Address Components ---
    city: Optional[str] = Field(default=None, sa_column=Column(String, index=True))
    district: Optional[str] = Field(default=None, sa_column=Column(String, index=True))
    ward: Optional[str] = Field(default=None, sa_column=Column(String, index=True))
    street: Optional[str] = Field(default=None, sa_column=Column(String, index=True))
    country: Optional[str] = Field(default="Vietnam", sa_column=Column(String, index=True))
    
    # --- Metadata ---
    categories: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(String)))
    vibes: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(String)))
    mood: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(String)))
    highlights: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(String)))  # From Google Maps
    price_level: Optional[str] = None # PRICE_LEVEL_MODERATE, etc.
    
    # --- Menu (JSONB) ---
    # Lưu danh sách món ăn. Backend thao tác như List[MenuItem]
    menu: List[MenuItem] = Field(default=[], sa_column=Column(JSONB)) 
    
    # --- Metrics & Cache ---
    rating: Optional[float] = Field(default=None, sa_column=Column(Numeric(2, 1))) # Google Rating
    aesthetic_score: Optional[int] = Field(default=0) # AI/Admin chấm điểm thẩm mỹ
    
    # Denormalization Fields (Đếm số lượng để query nhanh)
    upvote_count: int = Field(default=0, index=True) 
    memo_count: int = Field(default=0)
    
    # --- Media & External ---
    images: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(String)))
    local_image_path: Optional[str] = None
    google_maps_url: Optional[str] = None
    opening_hours: Optional[str] = Field(default=None, sa_column=Column(Text))
    
    # --- Coordinates (Simple) ---
    # Dùng để FE vẽ map nhanh, sync với PostGIS column bên dưới
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # --- AI Data ---
    raw_ai_response: Dict[str, Any] = Field(default={}, sa_column=Column(JSONB))

# ==========================================
# 2. DATABASE TABLES
# ==========================================

# --- Social Graph (Link Table) ---
class UserFollow(SQLModel, table=True):
    __tablename__ = "user_follows"
    follower_id: uuid.UUID = Field(foreign_key="users.id", primary_key=True)
    following_id: uuid.UUID = Field(foreign_key="users.id", primary_key=True)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))

# --- Collection Items (Link Table) ---
class CollectionItem(SQLModel, table=True):
    __tablename__ = "collection_items"
    collection_id: uuid.UUID = Field(foreign_key="collections.id", primary_key=True)
    place_id: uuid.UUID = Field(foreign_key="places.id", primary_key=True)
    
    added_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))
    note: Optional[str] = None # Note riêng: "Quán này để hẹn hò ok"
    
    collection: "Collection" = Relationship(back_populates="items")
    place: "Place" = Relationship(back_populates="collection_items")

# --- MAIN MODELS ---

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    username: Optional[str] = Field(default=None, sa_column=Column(String, unique=True, index=True))
    role: Role = Field(default=Role.USER)
    is_active: bool = Field(default=True)
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))
    last_login: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))

    # Relationships
    oauth_accounts: List["OAuthAccount"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    profile: Optional["Profile"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False})
    
    interactions: List["Interaction"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    memos: List["Memo"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    collections: List["Collection"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    lists: List["UserList"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    chat_sessions: List["ChatSession"] = Relationship(back_populates="user")
    
    # Note: Relationship Followers/Following cần config phức tạp hơn trong SQLModel nếu muốn access trực tiếp,
    # tạm thời query thông qua bảng UserFollow.

class OAuthAccount(SQLModel, table=True):
    __tablename__ = "oauth_accounts"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    provider: str # google, facebook
    provider_user_id: str
    
    access_token: Optional[str] = Field(sa_column=Column(Text))
    refresh_token: Optional[str] = Field(sa_column=Column(Text))
    expires_at: Optional[datetime] = Field(sa_column=Column(DateTime(timezone=True)))
    
    user: User = Relationship(back_populates="oauth_accounts")

class Profile(SQLModel, table=True):
    __tablename__ = "profiles"
    user_id: uuid.UUID = Field(foreign_key="users.id", primary_key=True, ondelete="CASCADE")
    
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = Field(sa_column=Column(Text))
    
    # AI Personalization
    vibe_embedding: Optional[List[float]] = Field(default=None, sa_column=Column(Vector(3072)))
    preferences: Dict = Field(default={}, sa_column=Column(JSONB)) # {"tags": ["quiet", "jazz"], ...}

    user: User = Relationship(back_populates="profile")

class Place(PlaceBase, table=True):
    __tablename__ = "places"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    # PostGIS Location (Sync với lat/lon)
    location: Optional[Any] = Field(default=None, sa_column=Column(Geometry("POINT", srid=4326)))
    
    # Vector Embedding
    embedding: Optional[List[float]] = Field(default=None, sa_column=Column(Vector(3072)))
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))
    updated_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()))

    # Relationships
    interactions: List["Interaction"] = Relationship(back_populates="place")
    memos: List["Memo"] = Relationship(back_populates="place")
    collection_items: List["CollectionItem"] = Relationship(back_populates="place")

class Interaction(SQLModel, table=True):
    __tablename__ = "interactions"
    # Mỗi user chỉ được có 1 loại interaction (VD: 1 upvote) cho 1 quán
    __table_args__ = (
        UniqueConstraint("user_id", "place_id", "type", name="unique_user_place_interaction"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    place_id: uuid.UUID = Field(foreign_key="places.id", ondelete="CASCADE", index=True)
    
    type: InteractionType = Field(index=True)
    score: float = Field(default=1.0) # Dùng để tính toán trọng số recommendation
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))

    user: User = Relationship(back_populates="interactions")
    place: Place = Relationship(back_populates="interactions")

class Memo(SQLModel, table=True):
    __tablename__ = "memos"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    place_id: uuid.UUID = Field(foreign_key="places.id", ondelete="CASCADE", index=True)
    
    # Content
    content: Optional[str] = Field(sa_column=Column(Text))
    images: Optional[List[str]] = Field(default=[], sa_column=Column(ARRAY(String)))
    
    # Context
    visit_date: datetime = Field(default_factory=datetime.utcnow)
    visibility: MemoVisibility = Field(default=MemoVisibility.PUBLIC)
    rating: Optional[int] = Field(default=None) # Hidden rating for AI (1-5)
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))
    updated_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()))

    user: User = Relationship(back_populates="memos")
    place: Place = Relationship(back_populates="memos")

class Collection(SQLModel, table=True):
    __tablename__ = "collections"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    
    name: str
    description: Optional[str] = None
    is_public: bool = Field(default=True)
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))
    
    user: User = Relationship(back_populates="collections")
    items: List["CollectionItem"] = Relationship(back_populates="collection", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_sessions"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", ondelete="SET NULL")
    session_id: str = Field(index=True) # Public/Cookie ID
    
    title: Optional[str] = None
    messages: List[Dict] = Field(default=[], sa_column=Column(JSONB))
    seen_place_ids: List[str] = Field(default=[], sa_column=Column(ARRAY(String)))
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))
    updated_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()))

    user: Optional[User] = Relationship(back_populates="chat_sessions")

class AppConfig(SQLModel, table=True):
    __tablename__ = "app_config"
    key: str = Field(primary_key=True)
    data: Dict[str, Any] = Field(default={}, sa_column=Column(JSONB))
    updated_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()))

# ==========================================
# 3. ANALYTICS & SYSTEM MODELS
# ==========================================

class AnalyticsEvent(SQLModel, table=True):
    """High-write event log. Use UNLOGGED table in production for performance.
    
    Workers roll up these events into monthly/daily stats, then purge old rows.
    """
    __tablename__ = "analytics_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    event_type: str = Field(index=True)  # VIEW_DETAIL, SEARCH, UPVOTE, BOOKMARK, LOGIN, etc.
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", ondelete="SET NULL", index=True)
    entity_id: Optional[str] = None      # place_id, memo_id, etc. (string for flexibility)
    payload: Dict[str, Any] = Field(default={}, sa_column=Column(JSONB))  # Extra context (search_query, etc.)
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now(), index=True))


class LLMUsageLog(SQLModel, table=True):
    """Log individual AI requests and token usage."""
    __tablename__ = "llm_usage_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", ondelete="SET NULL", index=True)
    request_type: str = Field(index=True)  # "chat", "analysis", "ocr", "aesthetic"
    model_name: str
    
    prompt_tokens: int = Field(default=0)
    output_tokens: int = Field(default=0)
    total_tokens: int = Field(default=0)
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now(), index=True))


class UserMonthlyStat(SQLModel, table=True):
    """Rolled-up monthly stats per user. Generated by nightly worker task."""
    __tablename__ = "user_monthly_stats"
    __table_args__ = (
        UniqueConstraint("user_id", "month", name="unique_user_month"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    month: str = Field(index=True)  # "2026-02"
    
    total_searches: int = Field(default=0)
    total_views: int = Field(default=0)
    total_shares: int = Field(default=0)
    total_bookmarks: int = Field(default=0)
    top_vibe: Optional[str] = None
    top_category: Optional[str] = None
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))
    updated_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()))


class SystemDailyStat(SQLModel, table=True):
    """Rolled-up daily system-wide stats. Generated by nightly worker task."""
    __tablename__ = "system_daily_stats"

    date: str = Field(primary_key=True)  # "2026-02-12"
    
    total_searches: int = Field(default=0)
    total_views: int = Field(default=0)
    total_new_places: int = Field(default=0)
    total_new_users: int = Field(default=0)
    total_active_users: int = Field(default=0)
    zero_result_keywords: List[str] = Field(default=[], sa_column=Column(ARRAY(String)))
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))


# ==========================================
# 4. NOTIFICATION MODEL
# ==========================================

class NotificationType(str, Enum):
    FOLLOW = "follow"
    UPVOTE_MEMO = "upvote_memo"
    SYSTEM = "system"

class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    recipient_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    actor_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id", ondelete="SET NULL")
    
    type: NotificationType = Field(index=True)
    entity_id: Optional[str] = None  # Polymorphic: place_id, memo_id, etc.
    message: Optional[str] = Field(default=None, sa_column=Column(Text))
    
    is_read: bool = Field(default=False, index=True)
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))

# ==========================================
# 5. USER LISTS MODEL
# ==========================================

class ListPrivacy(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    SHARED = "shared"

class UserList(SQLModel, table=True):
    __tablename__ = "user_lists"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    
    name: str
    description: Optional[str] = None
    privacy: ListPrivacy = Field(
        default=ListPrivacy.PUBLIC,
        sa_column=Column(SAEnum(ListPrivacy, values_callable=lambda obj: [e.value for e in obj]))
    )
    # items: List of { "place_id": str, "suggested_dishes": [str] }
    items: List[Dict] = Field(default=[], sa_column=Column(JSONB)) 
    
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))
    updated_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()))

    user: User = Relationship(back_populates="lists")
    
    # Relationship to follows
    # followers: List["UserListFollow"] = Relationship(back_populates="user_list")

class UserListFollow(SQLModel, table=True):
    __tablename__ = "user_list_follows"
    user_id: uuid.UUID = Field(foreign_key="users.id", primary_key=True)
    list_id: uuid.UUID = Field(foreign_key="user_lists.id", primary_key=True)
    created_at: datetime = Field(sa_column=Column(DateTime(timezone=True), server_default=func.now()))