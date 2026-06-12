import asyncio
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from config.database import get_db
from routers.agents import RunPipelineRequest, run_pipeline

scheduler = AsyncIOScheduler()

async def run_daily_followups():
    """
    Cron Job: Queries the DB for accounts that need follow-ups today,
    and automatically triggers the LangGraph pipeline for them.
    """
    print(f"[{datetime.utcnow().isoformat()}] 🕒 CRON: Running daily account lookup...")
    db = get_db()
    if db is None:
        return

    # In a real scenario, this queries specific dates from the database.
    # For testing, we'll grab accounts with high overdue days.
    cursor = db["accounts"].find({"daysOverdue": {"$gt": 0}})
    accounts = await cursor.to_list(length=100)
    
    triggered_count = 0
    for account in accounts:
        customer_id = str(account["customerId"])
        
        print(f"[{datetime.utcnow().isoformat()}] 🤖 CRON: Checking follow-ups for Customer {customer_id}")
        
        # We wrap in try-except so one failure doesn't crash the loop
        try:
            # req = RunPipelineRequest(customer_id=customer_id)
            # mock_user = {"role": "system_cron", "email": "cron@system.local"}
            # print(f"[{datetime.utcnow().isoformat()}] 🚀 CRON: Triggering AI Pipeline for {customer_id}...")
            # await run_pipeline(req, mock_user)
            # triggered_count += 1
            pass # Commented out the actual execution to prevent spamming your real Gmail!
        except Exception as e:
            print(f"[{datetime.utcnow().isoformat()}] ⚠️ CRON: Failed to run pipeline for {customer_id}: {str(e)}")

    print(f"[{datetime.utcnow().isoformat()}] ✅ CRON: Follow-up check complete. Simulated {len(accounts)} checks.")

import base64
from config.google_client import build_credentials, get_gmail_service
from routers.agents import LogCommunicationRequest, log_communication

async def run_inbound_email_processing():
    """
    Cron Job: Checks Gmail for unread replies, matches them to customers,
    and runs them through the AI Intent & Sentiment agents.
    """
    print(f"[{datetime.utcnow().isoformat()}] 📥 CRON: Checking inbound emails for replies...")
    db = get_db()
    if db is None: return

    user = await db["users"].find_one({"accessToken": {"$exists": True}})
    if not user or not user.get("accessToken"):
        return

    try:
        creds = build_credentials(user["accessToken"], user.get("refreshToken"))
        gmail = get_gmail_service(creds)
        
        # Get unread emails
        messages_resp = gmail.users().messages().list(userId="me", q="is:unread", maxResults=5).execute()
        messages = messages_resp.get("messages", [])
        
        for msg in messages:
            msg_id = msg["id"]
            full_msg = gmail.users().messages().get(userId="me", id=msg_id, format="full").execute()
            
            headers = {h["name"]: h["value"] for h in full_msg.get("payload", {}).get("headers", [])}
            from_header = headers.get("From", "")
            
            # Extract email address
            email_address = from_header
            if "<" in from_header and ">" in from_header:
                email_address = from_header.split("<")[1].split(">")[0]
            
            # Find customer
            customer = await db["customers"].find_one({"email": email_address})
            if not customer:
                gmail.users().messages().modify(userId="me", id=msg_id, body={"removeLabelIds": ["UNREAD"]}).execute()
                continue
                
            print(f"[{datetime.utcnow().isoformat()}] 🎯 CRON: Found reply from known customer: {email_address}")
            
            # Extract body
            body = full_msg.get("snippet", "")
            
            # Call AI Log Communication logic (Intent + Sentiment + Escalation)
            req = LogCommunicationRequest(
                customerId=str(customer["_id"]),
                sender="Customer",
                messageType="Email",
                content=body
            )
            mock_user = {"role": "system_cron", "email": "cron@system.local", "id": str(user["_id"])}
            
            await log_communication(req, mock_user)
            print(f"[{datetime.utcnow().isoformat()}] ✅ CRON: Processed and logged AI intent for {email_address}")
            
            # Mark as read
            gmail.users().messages().modify(userId="me", id=msg_id, body={"removeLabelIds": ["UNREAD"]}).execute()

    except Exception as e:
        print(f"[{datetime.utcnow().isoformat()}] ⚠️ CRON: Inbound processing error: {e}")

def start_scheduler():
    # Runs every 1 minute for testing purposes.
    scheduler.add_job(run_daily_followups, 'interval', minutes=1)
    scheduler.add_job(run_inbound_email_processing, 'interval', minutes=1)
    scheduler.start()
    print("▶️ Background Scheduler is now running for Real-time processing!")

def stop_scheduler():
    try:
        scheduler.shutdown()
    except Exception:
        pass
