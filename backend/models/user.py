from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from bson import ObjectId


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "Collection Officer"  # Admin | Collection Officer
    avatar: Optional[str] = None


class UserCreate(UserBase):
    google_id: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None


class UserResponse(UserBase):
    id: str
    has_google_integration: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
