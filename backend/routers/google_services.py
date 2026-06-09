from fastapi import APIRouter, HTTPException, Depends, Query
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


@router.get("/inbox")
async def get_gmail_inbox(
    label: str = Query("INBOX"),
    current_user: dict = Depends(get_current_user),
):
    """
    Fetch Gmail inbox messages for the current user.
    Returns real Gmail data if credentials are set, otherwise mock emails.
    """
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
    has_creds = user and user.get("accessToken")

    if has_creds:
        try:
            from config.google_client import build_credentials, get_gmail_service

            creds = build_credentials(user["accessToken"], user.get("refreshToken"))
            gmail = get_gmail_service(creds)

            messages_resp = gmail.users().messages().list(
                userId="me", labelIds=[label], maxResults=20
            ).execute()
            messages = messages_resp.get("messages", [])

            emails = []
            for msg in messages[:15]:
                detail = gmail.users().messages().get(
                    userId="me", messageId=msg["id"], format="metadata",
                    metadataHeaders=["From", "Subject", "Date"]
                ).execute()
                headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
                emails.append({
                    "id": detail["id"],
                    "from": headers.get("From", "Unknown Sender"),
                    "subject": headers.get("Subject", "(No Subject)"),
                    "snippet": detail.get("snippet", ""),
                    "date": headers.get("Date", ""),
                    "isUnread": "UNREAD" in detail.get("labelIds", []),
                    "body": "",
                })
            return {"emails": emails, "isRealData": True}
        except Exception as e:
            # Fall through to mock if real fails
            pass

    # ── Mock emails ──────────────────────────────────────────────────────
    from datetime import datetime, timedelta
    mock = [
        {
            "id": f"mock_{i}",
            "from": f"{name} <{email}>",
            "subject": subject,
            "snippet": snippet,
            "date": (datetime.utcnow() - timedelta(days=i)).isoformat(),
            "isUnread": i < 3,
            "body": f"<p>{snippet}</p>",
        }
        for i, (name, email, subject, snippet) in enumerate([
            ("John Doe", "john.doe@example.com", "Regarding my overdue balance",
             "I would like to discuss a payment plan for my outstanding amount..."),
            ("Sarah Jenkins", "sarah.j@example.com", "Payment plan request",
             "I lost my job last month and cannot make the full payment right now..."),
            ("Robert Chen", "robert.chen@example.com", "Dispute on account",
             "I believe there is an error in my account balance. The amount shown..."),
            ("Emma Watson", "emma.w@example.com", "Payment confirmation",
             "I have transferred the full outstanding amount. Please find the reference..."),
            ("Michael Scott", "michael.s@example.com", "Need more time",
             "Due to a medical emergency I am requesting a 30-day extension..."),
        ])
    ]
    return {"emails": mock, "isRealData": False}


class ImportSheetRequest(BaseModel):
    spreadsheetId: str


@router.post("/import")
async def import_from_sheet(body: ImportSheetRequest, current_user: dict = Depends(get_current_user)):
    """Import customers from a Google Sheet (stub — mocks success for demo)."""
    return {
        "importedCount": 5,
        "isRealImport": False,
        "message": "Demo: Connect Google Sheets API to import real data.",
    }

