from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PaymentHistoryItem(BaseModel):
    date: datetime
    amount: float
    status: str  # Success | Pending | Failed


class ContactHistoryItem(BaseModel):
    date: datetime
    channel: str  # Email | SMS | Call
    notes: str


class AccountResponse(BaseModel):
    id: Optional[str] = None
    customer_id: str
    outstanding_amount: float = 0
    days_overdue: int = 0
    risk_score: int = 0
    payment_history: List[PaymentHistoryItem] = []
    contact_history: List[ContactHistoryItem] = []
    last_paid_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AddPaymentRequest(BaseModel):
    amount: float
    date: Optional[str] = None
    status: str = "Success"
