"""
Bad Debt Collection Platform – Python FastAPI Backend
=====================================================
Replaces the Node.js/Express backend with:
  - FastAPI (async REST API)
  - Motor (async MongoDB driver)
  - LangGraph multi-agent pipeline (7 nodes)
  - Groq LLM (llama-3.3-70b-versatile)
  - Google APIs (Gmail, Calendar, Sheets, Drive, Slides, Docs)

API contract is identical to the Node.js backend so the React frontend
requires zero changes.
"""

import os
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from config.database import connect_db, close_db, get_db
from config.groq_client import get_groq_client

from routers import auth, agents, customers, dashboard, google_services

load_dotenv()

CLIENT_URL = os.getenv("CLIENT_URL", "http://localhost:5173")
PORT = int(os.getenv("PORT", 8000))


# ── Startup / Shutdown lifecycle ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_db()
    get_groq_client()  # Pre-warm Groq client
    from cron_jobs import start_scheduler, stop_scheduler
    start_scheduler()
    await seed_database()
    yield
    # Shutdown
    stop_scheduler()
    await close_db()


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Bad Debt Collection Platform API",
    description="AI Multi-Agent Bad Debt Collection Platform (FastAPI + LangGraph)",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Routers (same paths as Node.js backend) ───────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(google_services.router, prefix="/api/google", tags=["Google Services"])

# Also mount google services under old paths for frontend compatibility
app.include_router(google_services.router, prefix="/api/gmail", tags=["Gmail"], include_in_schema=False)
app.include_router(google_services.router, prefix="/api/calendar", tags=["Calendar"], include_in_schema=False)
app.include_router(google_services.router, prefix="/api/sheets", tags=["Sheets"], include_in_schema=False)


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat(), "framework": "FastAPI + LangGraph"}


# ── Database Seeder ───────────────────────────────────────────────────────────
async def seed_database():
    """Seed the database with test users, customers and accounts if empty."""
    db = get_db()
    if db is None:
        return

    user_count = await db["users"].count_documents({})
    if user_count > 0:
        return

    now = datetime.utcnow()
    print("🌱 Seeding database...")

    admin = await db["users"].insert_one({
        "name": "System Admin",
        "email": "admin@example.com",
        "role": "Admin",
        "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80",
        "createdAt": now, "updatedAt": now,
    })
    officer = await db["users"].insert_one({
        "name": "Jane Smith",
        "email": "officer@example.com",
        "role": "Collection Officer",
        "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
        "createdAt": now, "updatedAt": now,
    })

    seed_customers = [
        {"name": "John Doe", "email": "john.doe@example.com", "phone": "+1-555-0100", "status": "Active", "assignedOfficer": officer.inserted_id},
        {"name": "Sarah Jenkins", "email": "sarah.j@example.com", "phone": "+1-555-0101", "status": "Active", "assignedOfficer": officer.inserted_id},
        {"name": "Robert Chen", "email": "robert.chen@example.com", "phone": "+1-555-0102", "status": "Escalated", "assignedOfficer": officer.inserted_id},
        {"name": "Emma Watson", "email": "emma.w@example.com", "phone": "+1-555-0103", "status": "Settled", "assignedOfficer": officer.inserted_id},
        {"name": "Michael Scott", "email": "michael.s@example.com", "phone": "+1-555-0104", "status": "Disputed", "assignedOfficer": officer.inserted_id},
    ]
    seed_accounts = [
        {"outstandingAmount": 2500, "daysOverdue": 45, "riskScore": 60, "paymentHistory": [{"date": now, "amount": 500, "status": "Failed"}], "contactHistory": [{"date": now, "channel": "Email", "notes": "Sent initial reminder."}]},
        {"outstandingAmount": 8500, "daysOverdue": 78, "riskScore": 85, "paymentHistory": [], "contactHistory": [{"date": now, "channel": "SMS", "notes": "Automated follow-up sent."}]},
        {"outstandingAmount": 12000, "daysOverdue": 112, "riskScore": 95, "paymentHistory": [], "contactHistory": [{"date": now, "channel": "Call", "notes": "No answer. Voicemail left."}]},
        {"outstandingAmount": 0, "daysOverdue": 0, "riskScore": 0, "lastPaidDate": now, "paymentHistory": [{"date": now, "amount": 1500, "status": "Success"}], "contactHistory": []},
        {"outstandingAmount": 5400, "daysOverdue": 62, "riskScore": 75, "paymentHistory": [], "contactHistory": [{"date": now, "channel": "Email", "notes": "Customer disputed validity."}]},
    ]

    for i, cust_data in enumerate(seed_customers):
        cust_data["createdAt"] = now
        cust_data["updatedAt"] = now
        cust_result = await db["customers"].insert_one(cust_data)
        acct = seed_accounts[i]
        acct["customerId"] = cust_result.inserted_id
        acct["createdAt"] = now
        acct["updatedAt"] = now
        await db["accounts"].insert_one(acct)

    print("✅ Database seeded: admin@example.com, officer@example.com + 5 customers")


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
