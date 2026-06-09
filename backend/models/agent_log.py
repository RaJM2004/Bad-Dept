from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class AgentLogCreate(BaseModel):
    agent_name: str
    status: str  # Success | Error
    request_details: Optional[Any] = None
    response_details: Optional[Any] = None
    duration_ms: int
    error_message: Optional[str] = None


class AgentLogResponse(AgentLogCreate):
    id: str
    created_at: Optional[datetime] = None
