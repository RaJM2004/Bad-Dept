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
        message["To"] = body.to
        message["Subject"] = body.subject
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
                userId="me", labelIds=[label], maxResults=50
            ).execute()
            messages = messages_resp.get("messages", [])

            emails = []
            
            def callback(request_id, response, exception):
                if exception is not None:
                    print("Batch fetch error:", exception)
                else:
                    headers = {h["name"]: h["value"] for h in response.get("payload", {}).get("headers", [])}
                    
                    # Extract body
                    body = ""
                    payload = response.get("payload", {})
                    parts = payload.get("parts", [])
                    
                    import base64
                    def decode_data(data):
                        try:
                            # Add necessary padding
                            data += "=" * ((4 - len(data) % 4) % 4)
                            return base64.urlsafe_b64decode(data).decode("utf-8")
                        except Exception as e:
                            print("Decode error:", e)
                            return ""

                    if not parts and "body" in payload and "data" in payload["body"]:
                        body = decode_data(payload["body"]["data"])
                    else:
                        # Try HTML first
                        for part in parts:
                            if part.get("mimeType") == "text/html" and "data" in part.get("body", {}):
                                body = decode_data(part["body"]["data"])
                                break
                        # Fallback to plain text
                        if not body:
                            for part in parts:
                                if part.get("mimeType") == "text/plain" and "data" in part.get("body", {}):
                                    body = decode_data(part["body"]["data"])
                                    break

                    emails.append({
                        "id": response["id"],
                        "from": headers.get("From", "Unknown Sender"),
                        "subject": headers.get("Subject", "(No Subject)"),
                        "snippet": response.get("snippet", ""),
                        "date": headers.get("Date", ""),
                        "isUnread": "UNREAD" in response.get("labelIds", []),
                        "body": body,
                    })

            # Chunk the batch request to avoid 429 Too many concurrent requests
            import time
            chunk_size = 10
            for i in range(0, len(messages[:30]), chunk_size):
                batch = gmail.new_batch_http_request(callback=callback)
                for msg in messages[i:i + chunk_size]:
                    batch.add(gmail.users().messages().get(
                        userId="me", id=msg["id"], format="full"
                    ))
                batch.execute()
                time.sleep(0.5)  # Pause slightly between chunks
            
            return {"emails": emails, "isRealData": True}
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Gmail API Error: {str(e)}")

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
    """Import customers from a Google Sheet."""
    db = get_db()
    user = await db["users"].find_one({"_id": ObjectId(current_user["id"])})
    if not user or not user.get("accessToken"):
        raise HTTPException(status_code=400, detail="No Google integration found. Please connect Google account first.")

    try:
        from config.google_client import build_credentials, get_sheets_service
        from datetime import datetime

        creds = build_credentials(user["accessToken"], user.get("refreshToken"))
        sheets = get_sheets_service(creds)

        # Assuming data is on 'Sheet1'
        result = sheets.spreadsheets().values().get(
            spreadsheetId=body.spreadsheetId, range="Sheet1"
        ).execute()
        
        rows = result.get("values", [])
        if not rows or len(rows) < 2:
            return {"importedCount": 0, "isRealImport": True, "message": "Sheet is empty or missing data rows."}
            
        headers = [h.lower().replace(" ", "") for h in rows[0]]
        
        # Expected column mappings (flexible)
        idx_name = next((i for i, h in enumerate(headers) if 'name' in h), 0)
        idx_email = next((i for i, h in enumerate(headers) if 'email' in h), 1)
        idx_phone = next((i for i, h in enumerate(headers) if 'phone' in h), 2)
        idx_status = next((i for i, h in enumerate(headers) if 'status' in h), 3)
        idx_amount = next((i for i, h in enumerate(headers) if 'amount' in h or 'outstanding' in h), 4)
        idx_overdue = next((i for i, h in enumerate(headers) if 'overdue' in h or 'days' in h), 5)
        idx_risk = next((i for i, h in enumerate(headers) if 'risk' in h), 6)

        count = 0
        now = datetime.utcnow()
        officer_id = user["_id"]

        for row in rows[1:]:
            if len(row) <= idx_name or not row[idx_name]:
                continue
                
            def safe_get(idx, default=""):
                return row[idx] if len(row) > idx else default
                
            def safe_num(idx, default=0):
                try:
                    val = safe_get(idx, str(default)).replace('$', '').replace(',', '').strip()
                    return float(val) if '.' in val else int(val)
                except:
                    return default

            name = safe_get(idx_name, "Unknown")
            email = safe_get(idx_email, "")
            
            # Upsert customer
            cust_doc = {
                "name": name,
                "email": email,
                "phone": safe_get(idx_phone, ""),
                "status": safe_get(idx_status, "Active"),
                "assignedOfficer": officer_id,
                "updatedAt": now
            }
            
            cust_result = await db["customers"].update_one(
                {"email": email} if email else {"name": name, "phone": cust_doc["phone"]},
                {"$set": cust_doc, "$setOnInsert": {"createdAt": now}},
                upsert=True
            )
            
            # Find the actual ID
            if cust_result.upserted_id:
                cust_id = cust_result.upserted_id
            else:
                existing = await db["customers"].find_one({"email": email} if email else {"name": name, "phone": cust_doc["phone"]})
                cust_id = existing["_id"]

            # Upsert account
            acct_doc = {
                "customerId": cust_id,
                "outstandingAmount": safe_num(idx_amount, 0),
                "daysOverdue": int(safe_num(idx_overdue, 0)),
                "riskScore": int(safe_num(idx_risk, 0)),
                "updatedAt": now
            }
            
            await db["accounts"].update_one(
                {"customerId": cust_id},
                {"$set": acct_doc, "$setOnInsert": {"createdAt": now, "paymentHistory": [], "contactHistory": []}},
                upsert=True
            )
            count += 1

        return {
            "importedCount": count,
            "isRealImport": True,
            "message": f"Successfully imported {count} records.",
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to import from Google Sheets: {str(e)}")

