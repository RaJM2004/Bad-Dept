from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PaymentScheduleItem(BaseModel):
    due_date: datetime
    amount: float
    paid_date: Optional[datetime] = None
    status: str = "Unpaid"  # Unpaid | Paid | Overdue


class PaymentPlanCreate(BaseModel):
    customer_id: str
    total_amount: float
    emi_amount: float
    frequency: str = "Monthly"
    installments_count: int
    start_date: datetime
    schedule: List[PaymentScheduleItem] = []


class PaymentPlanResponse(PaymentPlanCreate):
    id: str
    paid_installments_count: int = 0
    status: str = "Active"  # Active | Completed | Defaulted
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
