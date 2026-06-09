from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class CustomerCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    outstanding_amount: float = 0
    days_overdue: int = 0
    assigned_officer: Optional[str] = None


class CustomerUpdate(BaseModel):
    status: Optional[str] = None  # Active | Settled | Disputed | Escalated | Inactive
    assigned_officer: Optional[str] = None


class CustomerResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    status: str
    assigned_officer: Optional[dict] = None
    google_sheet_row_id: Optional[int] = None
    outstanding_amount: float = 0
    days_overdue: int = 0
    risk_score: int = 0
    has_active_plan: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
