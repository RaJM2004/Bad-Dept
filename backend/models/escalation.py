from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class EscalationCreate(BaseModel):
    customer_id: str
    reason: str
    severity: str = "High"  # Low | Medium | High | Critical
    status: str = "Pending"  # Pending | In Progress | Resolved
    assigned_to: Optional[str] = None


class EscalationResponse(EscalationCreate):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
