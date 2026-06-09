from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from middleware.auth import get_current_user
from config.database import get_db
from bson import ObjectId

router = APIRouter()


class GoogleAuthRequest(BaseModel):
    code: str


class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    customer_id: Optional[str] = None


class CreateCalendarEventRequest(BaseModel):
    summary: str
    description: Optional[str] = None
    start_datetime: str  # ISO format
    end_datetime: str


class ReadSheetRequest(BaseModel):
    spreadsheet_id: str
    range: str


@router.post("/auth/google")
async def google_service_auth(body: GoogleAuthRequest, current_user: dict = Depends(get_current_user)):
    """Exchange a Google auth code for tokens and store them for the current user."""
    try:
        from config.google_client import get_oauth2_flow
        flow = get_oauth2_flow()
        flow.fetch_token(code=body.code)
        creds = flow.credentials

        db = get_db()
        await db["users"].update_one(
            {"_id": ObjectId(current_user["id"])},
            {"$set": {"accessToken": creds.token, "refreshToken": creds.refresh_token}},
        )
        return {"message": "Google services connected successfully", "hasGoogleIntegration": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google auth failed: {str(e)}")


@router.post("/send")
async def send_gmail(body: SendEmailRequest, current_user: dict = Depends(get_current_user)):
    """Send an email via Gmail API using the current user's credentials."""
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
    if not user or not user.get("accessToken"):
        raise HTTPException(status_code=400, detail="No Google integration found. Please connect Google account first.")

    try:
        import base64
        from email.mime.text import MIMEText
        from config.google_client import build_credentials, get_gmail_service

        creds = build_credentials(user["accessToken"], user.get("refreshToken"))
        gmail = get_gmail_service(creds)

        message = MIMEText(body.body, "html")
        message["to"] = body.to
        message["subject"] = body.subject
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        result = gmail.users().messages().send(userId="me", body={"raw": raw}).execute()
        return {"message": "Email sent successfully", "messageId": result.get("id")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


@router.post("/calendar/create")
async def create_calendar_event(body: CreateCalendarEventRequest, current_user: dict = Depends(get_current_user)):
    """Create a Google Calendar event."""
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
    if not user or not user.get("accessToken"):
        raise HTTPException(status_code=400, detail="No Google integration found.")

    try:
        from config.google_client import build_credentials, get_calendar_service

        creds = build_credentials(user["accessToken"], user.get("refreshToken"))
        cal = get_calendar_service(creds)

        event_body = {
            "summary": body.summary,
            "description": body.description or "",
            "start": {"dateTime": body.start_datetime, "timeZone": "UTC"},
            "end": {"dateTime": body.end_datetime, "timeZone": "UTC"},
        }
        event = cal.events().insert(calendarId="primary", body=event_body).execute()
        return {"message": "Calendar event created", "eventId": event.get("id"), "eventLink": event.get("htmlLink")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create calendar event: {str(e)}")


@router.post("/sheets/read")
async def read_google_sheet(body: ReadSheetRequest, current_user: dict = Depends(get_current_user)):
    """Read data from a Google Sheet."""
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
    if not user or not user.get("accessToken"):
        raise HTTPException(status_code=400, detail="No Google integration found.")

    try:
        from config.google_client import build_credentials, get_sheets_service

        creds = build_credentials(user["accessToken"], user.get("refreshToken"))
        sheets = get_sheets_service(creds)

        result = sheets.spreadsheets().values().get(
            spreadsheetId=body.spreadsheet_id, range=body.range
        ).execute()
        return {"values": result.get("values", []), "range": result.get("range")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read sheet: {str(e)}")
