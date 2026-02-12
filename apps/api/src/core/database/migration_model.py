from datetime import datetime
from sqlmodel import SQLModel, Field
import uuid

class MigrationHistory(SQLModel, table=True):
    __tablename__ = "migration_history"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    version: str = Field(unique=True, index=True)
    applied_at: datetime = Field(default_factory=datetime.utcnow)
