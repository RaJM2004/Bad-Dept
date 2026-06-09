from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CommunicationCreate(BaseModel):
    customer_id: str
    sender: str  # customer | agent | officer
    message_type: str  # Email | SMS | Call | Chat
    content: str
    intent_category: Optional[str] = None
    intent_confidence: Optional[float] = None
    sentiment_category: Optional[str] = None
    sentiment_confidence: Optional[float] = None
    response_generated: Optional[str] = None
    response_sent: bool = False


class CommunicationResponse(CommunicationCreate):
    id: str
    created_at: Optional[datetime] = None
