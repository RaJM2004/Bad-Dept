import json
import time
from datetime import datetime
from typing import Optional, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from bson import ObjectId
from config.database import get_db
from config.groq_client import get_groq_client, is_groq_enabled
from middleware.auth import get_current_user
from agents.graph import pipeline, build_initial_state

router = APIRouter()


# ── Request models ────────────────────────────────────────────────────────────

class RunPipelineRequest(BaseModel):
    customer_id: str

class IntentRequest(BaseModel):
    message: str

class AccountLookupRequest(BaseModel):
    customerId: str

class SentimentRequest(BaseModel):
    message: str
    customerId: Optional[str] = None

class ResolutionRequest(BaseModel):
    customerId: str
    customerIntent: Optional[str] = None
    customerSentiment: Optional[str] = None

class LogCommunicationRequest(BaseModel):
    customerId: str
    sender: str
    messageType: str
    content: str

class GenerateEmailRequest(BaseModel):
    customerId: str
    recommendedAction: str
    paymentSchedule: str
    riskScore: Optional[int] = None

class RepaymentPlanRequest(BaseModel):
    customerId: str
    proposedAmount: float
    hardshipReason: Optional[str] = None

class DisputeRequest(BaseModel):
    customerId: str
    disputeReason: str

class AnalyticsRequest(BaseModel):
    metrics: Optional[Any] = None


# ── Helper ─────────────────────────────────────────────────────────────────────

async def _save_agent_log(db, agent_name: str, status: str, req: Any, resp: Any, duration_ms: int, error: str = None):
    try:
        await db["agentlogs"].insert_one({
            "agentName": agent_name,
            "status": status,
            "requestDetails": req,
            "responseDetails": resp,
            "durationMs": duration_ms,
            "errorMessage": error,
            "createdAt": datetime.utcnow(),
        })
    except Exception:
        pass


# ── NEW: Full LangGraph Pipeline Endpoint ──────────────────────────────────────

@router.post("/run-pipeline")
async def run_pipeline(body: RunPipelineRequest, current_user: dict = Depends(get_current_user)):
    """
    Triggers the full 7-node LangGraph bad debt collection pipeline for a customer.
    Returns the complete final state including all agent outputs and pipeline logs.
    """
    db = get_db()
    try:
        oid = ObjectId(body.customer_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID")

    customer = await db["customers"].find_one({"_id": oid})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    account = await db["accounts"].find_one({"customerId": oid})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Resolve officer email
    officer_email = None
    officer_id = None
    if customer.get("assignedOfficer"):
        officer = await db["users"].find_one({"_id": customer["assignedOfficer"]})
        if officer:
            officer_email = officer.get("email")
            officer_id = str(officer["_id"])

    # Serialize history (convert ObjectIds and dates)
    def _clean_list(lst):
        cleaned = []
        for item in lst:
            c = {}
            for k, v in item.items():
                if isinstance(v, ObjectId):
                    c[k] = str(v)
                elif isinstance(v, datetime):
                    c[k] = v.isoformat()
                else:
                    c[k] = v
            cleaned.append(c)
        return cleaned

    initial_state = build_initial_state(
        customer_id=str(customer["_id"]),
        customer_name=customer.get("name", "Unknown"),
        customer_email=customer.get("email", ""),
        customer_phone=customer.get("phone", ""),
        customer_status=customer.get("status", "Active"),
        outstanding_amount=float(account.get("outstandingAmount", 0)),
        days_overdue=int(account.get("daysOverdue", 0)),
        risk_score=int(account.get("riskScore", 0)),
        contact_history=_clean_list(account.get("contactHistory", [])),
        payment_history=_clean_list(account.get("paymentHistory", [])),
        assigned_officer_id=officer_id,
        assigned_officer_email=officer_email,
    )

    # Run the pipeline (synchronous — LangGraph runs sync nodes)
    start = time.time()
    final_state = pipeline.invoke(initial_state)
    duration_ms = int((time.time() - start) * 1000)

    # Build summary
    summary = {
        "customer": initial_state["customer_name"],
        "outstanding": initial_state["outstanding_amount"],
        "days_overdue": initial_state["days_overdue"],
        "priority": (final_state.get("screening_result") or {}).get("priority"),
        "channel_used": (final_state.get("outreach_result") or {}).get("channel_used"),
        "payment_plan": (final_state.get("payment_plan_result") or {}).get("plan_type"),
    }
    
    await _save_agent_log(
        db, "Pipeline Run", "Success" if final_state.get("pipeline_complete") else "Error",
        {"customer_id": body.customer_id},
        {
            "pipeline_run_id": final_state.get("pipeline_run_id"),
            "summary": summary,
            "executive_summary": (final_state.get("compliance_report") or {}).get("executive_summary"),
            "logs": final_state.get("pipeline_logs", [])
        },
        duration_ms,
    )

    return {
        "pipeline_run_id": final_state.get("pipeline_run_id"),
        "pipeline_complete": final_state.get("pipeline_complete"),
        "pipeline_logs": final_state.get("pipeline_logs", []),
        "screening_result": final_state.get("screening_result"),
        "contact_strategy": final_state.get("contact_strategy"),
        "outreach_result": {k: v for k, v in (final_state.get("outreach_result") or {}).items() if k != "email_html"},
        "payment_plan_result": final_state.get("payment_plan_result"),
        "human_collection_result": {k: v for k, v in (final_state.get("human_collection_result") or {}).items() if k != "email_html"},
        "status_update_result": final_state.get("status_update_result"),
        "compliance_report": final_state.get("compliance_report"),
        "error_message": final_state.get("error_message"),
        "duration_ms": duration_ms,
    }


# ── Individual Agent Endpoints (preserved from Node.js API) ───────────────────

@router.post("/intent")
async def detect_intent(body: IntentRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    start = time.time()
    try:
        if is_groq_enabled():
            client = get_groq_client()
            comp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "Classify intent: Payment Commitment, Payment Plan Request, Already Paid, Dispute, Refusal To Pay, General Inquiry, Unknown. Respond in JSON: {\"category\": \"...\", \"confidence\": 0.0}"},
                    {"role": "user", "content": body.message},
                ],
            )
            result = json.loads(comp.choices[0].message.content or "{}")
        else:
            msg = body.message.lower()
            cat = "General Inquiry"
            if any(w in msg for w in ["will pay", "tomorrow", "next week", "sending"]):
                cat = "Payment Commitment"
            elif any(w in msg for w in ["installment", "emi", "plan", "split"]):
                cat = "Payment Plan Request"
            elif any(w in msg for w in ["already paid", "transferred", "done"]):
                cat = "Already Paid"
            elif any(w in msg for w in ["dispute", "wrong", "incorrect", "not mine"]):
                cat = "Dispute"
            elif any(w in msg for w in ["will not pay", "refuse", "stop calling"]):
                cat = "Refusal To Pay"
            result = {"category": cat, "confidence": 0.85}

        await _save_agent_log(db, "Intent Detection", "Success", {"message": body.message}, result, int((time.time()-start)*1000))
        return result
    except Exception as e:
        await _save_agent_log(db, "Intent Detection", "Error", {"message": body.message}, None, int((time.time()-start)*1000), str(e))
        raise HTTPException(status_code=500, detail=f"Intent detection failed: {str(e)}")


@router.post("/account")
async def lookup_account(body: AccountLookupRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    start = time.time()
    try:
        oid = ObjectId(body.customerId)
        customer = await db["customers"].find_one({"_id": oid})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        account = await db["accounts"].find_one({"customerId": oid})
        plans = await db["paymentplans"].find({"customerId": oid}).to_list(None)

        result = {
            "customerId": str(customer["_id"]),
            "customerName": customer.get("name"),
            "customerEmail": customer.get("email"),
            "customerStatus": customer.get("status"),
            "outstandingAmount": account.get("outstandingAmount", 0) if account else 0,
            "daysOverdue": account.get("daysOverdue", 0) if account else 0,
            "riskScore": account.get("riskScore", 0) if account else 0,
            "paymentHistory": account.get("paymentHistory", []) if account else [],
            "contactHistory": account.get("contactHistory", []) if account else [],
            "paymentPlans": plans,
        }
        await _save_agent_log(db, "Account Lookup", "Success", {"customerId": body.customerId}, result, int((time.time()-start)*1000))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Account lookup failed: {str(e)}")


@router.post("/sentiment")
async def detect_sentiment(body: SentimentRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    start = time.time()
    try:
        if is_groq_enabled():
            client = get_groq_client()
            comp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "Classify sentiment: Positive, Neutral, Negative, Angry, Legal Threat. Detect escalation. Respond in JSON: {\"sentiment\": \"...\", \"confidence\": 0.0, \"shouldEscalate\": false, \"escalationReason\": \"...\"}"},
                    {"role": "user", "content": body.message},
                ],
            )
            result = json.loads(comp.choices[0].message.content or "{}")
        else:
            msg = body.message.lower()
            sentiment, escalate, reason = "Neutral", False, ""
            if any(w in msg for w in ["sue", "lawyer", "legal", "court"]):
                sentiment, escalate, reason = "Legal Threat", True, "Legal threat detected"
            elif any(w in msg for w in ["fuck", "harass", "stop calling"]):
                sentiment, escalate, reason = "Angry", True, "Hostile language detected"
            result = {"sentiment": sentiment, "confidence": 0.85, "shouldEscalate": escalate, "escalationReason": reason}

        await _save_agent_log(db, "Sentiment & Escalation", "Success", {"message": body.message}, result, int((time.time()-start)*1000))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")


@router.post("/resolution")
async def generate_resolution(body: ResolutionRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    start = time.time()
    try:
        oid = ObjectId(body.customerId)
        account = await db["accounts"].find_one({"customerId": oid})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        if is_groq_enabled():
            client = get_groq_client()
            comp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "Recommend: Full Payment, EMI Plan, Settlement Offer, Human Escalation. Output riskScore (0-100), paymentSchedule. JSON: {\"recommendedAction\":\"...\",\"reasoning\":\"...\",\"riskScore\":50,\"paymentSchedule\":\"...\",\"suggestedDiscountPercentage\":0}"},
                    {"role": "user", "content": f"Balance: ₹{account.get('outstandingAmount')}, Overdue: {account.get('daysOverdue')} days, Intent: {body.customerIntent}, Sentiment: {body.customerSentiment}"},
                ],
            )
            result = json.loads(comp.choices[0].message.content or "{}")
        else:
            overdue = account.get("daysOverdue", 0)
            outstanding = account.get("outstandingAmount", 0)
            if body.customerSentiment in ("Legal Threat", "Angry"):
                result = {"recommendedAction": "Human Escalation", "reasoning": "Escalated due to sentiment.", "riskScore": account.get("riskScore", 0), "paymentSchedule": "Escalate to officer", "suggestedDiscountPercentage": 0}
            elif overdue >= 90:
                disc = round(outstanding * 0.7, 2)
                result = {"recommendedAction": "Settlement Offer", "reasoning": "Severely delinquent.", "riskScore": account.get("riskScore", 0), "paymentSchedule": f"Lump-sum ₹{disc} (30% off)", "suggestedDiscountPercentage": 30}
            elif overdue >= 30:
                monthly = round(outstanding / 3, 2)
                result = {"recommendedAction": "EMI Plan", "reasoning": "Moderate overdue.", "riskScore": account.get("riskScore", 0), "paymentSchedule": f"3 × ₹{monthly}/month", "suggestedDiscountPercentage": 0}
            else:
                result = {"recommendedAction": "Full Payment", "reasoning": "Low overdue.", "riskScore": account.get("riskScore", 0), "paymentSchedule": f"Full ₹{outstanding}", "suggestedDiscountPercentage": 0}

        await _save_agent_log(db, "Resolution Generator", "Success", body.model_dump(), result, int((time.time()-start)*1000))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resolution generation failed: {str(e)}")


@router.post("/log")
async def log_communication(body: LogCommunicationRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    start = time.time()
    try:
        oid = ObjectId(body.customerId)
        customer = await db["customers"].find_one({"_id": oid})
        account = await db["accounts"].find_one({"customerId": oid})
        if not customer or not account:
            raise HTTPException(status_code=404, detail="Customer or account not found")

        # Run intent + sentiment via individual endpoints logic (inline)
        intent_cat, intent_conf = "General Inquiry", 0.8
        sentiment_cat, sentiment_conf, should_escalate, escalation_reason = "Neutral", 0.8, False, ""
        recommended, reasoning, schedule = "Full Payment", "", f"Full payment of ₹{account.get('outstandingAmount')}"

        if is_groq_enabled():
            client = get_groq_client()
            ic = client.chat.completions.create(model="llama-3.3-70b-versatile", temperature=0.1, response_format={"type": "json_object"}, messages=[{"role": "system", "content": "Classify intent: Payment Commitment, Payment Plan Request, Already Paid, Dispute, Refusal To Pay, General Inquiry, Unknown. JSON: {\"category\":\"...\",\"confidence\":0.0}"}, {"role": "user", "content": body.content}])
            ir = json.loads(ic.choices[0].message.content or "{}")
            intent_cat, intent_conf = ir.get("category", intent_cat), ir.get("confidence", intent_conf)

            sc = client.chat.completions.create(model="llama-3.3-70b-versatile", temperature=0.1, response_format={"type": "json_object"}, messages=[{"role": "system", "content": "Classify sentiment + escalation. JSON: {\"sentiment\":\"...\",\"confidence\":0.0,\"shouldEscalate\":false,\"escalationReason\":\"...\"}"}, {"role": "user", "content": body.content}])
            sr = json.loads(sc.choices[0].message.content or "{}")
            sentiment_cat, sentiment_conf = sr.get("sentiment", sentiment_cat), sr.get("confidence", sentiment_conf)
            should_escalate, escalation_reason = sr.get("shouldEscalate", False), sr.get("escalationReason", "")

        now = datetime.utcnow()
        comm_doc = {"customerId": oid, "sender": body.sender, "messageType": body.messageType, "content": body.content,
                    "intent": {"category": intent_cat, "confidence": intent_conf},
                    "sentiment": {"category": sentiment_cat, "confidence": sentiment_conf},
                    "responseGenerated": "", "responseSent": False, "createdAt": now}
        comm_result = await db["communications"].insert_one(comm_doc)

        await db["accounts"].update_one({"customerId": oid}, {"$push": {"contactHistory": {"date": now, "channel": body.messageType, "notes": f"Intent: {intent_cat}, Sentiment: {sentiment_cat}"}}, "$set": {"updatedAt": now}})

        if should_escalate:
            await db["customers"].update_one({"_id": oid}, {"$set": {"status": "Escalated", "updatedAt": now}})
            existing_esc = await db["escalations"].find_one({"customerId": oid, "status": {"$ne": "Resolved"}})
            if not existing_esc:
                await db["escalations"].insert_one({"customerId": oid, "reason": escalation_reason, "severity": "Critical" if sentiment_cat == "Legal Threat" else "High", "status": "Pending", "assignedTo": customer.get("assignedOfficer"), "createdAt": now})

        analysis = {"intent": {"category": intent_cat, "confidence": intent_conf}, "sentiment": {"category": sentiment_cat, "confidence": sentiment_conf, "shouldEscalate": should_escalate, "escalationReason": escalation_reason}, "resolution": {"recommendedAction": recommended, "reasoning": reasoning, "paymentSchedule": schedule}}
        await _save_agent_log(db, "Communication Log", "Success", body.model_dump(), analysis, int((time.time()-start)*1000))
        return {"communication": {"id": str(comm_result.inserted_id)}, "analysis": analysis}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Communication processing failed: {str(e)}")


@router.post("/generate-email")
async def generate_email(body: GenerateEmailRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(body.customerId)
        customer = await db["customers"].find_one({"_id": oid})
        account = await db["accounts"].find_one({"customerId": oid})
        if not customer or not account:
            raise HTTPException(status_code=404, detail="Customer or account not found")

        if is_groq_enabled():
            client = get_groq_client()
            comp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", temperature=0.4,
                messages=[{"role": "system", "content": f"""Write a persuasive FDCPA-compliant HTML debt collection email.
Customer: {customer.get('name')}, Amount: ₹{account.get('outstandingAmount')}, Days Overdue: {account.get('daysOverdue')}, Action: {body.recommendedAction}, Schedule: {body.paymentSchedule}.
Output ONLY raw HTML starting with <div>. No markdown. Use inline CSS. Include a blue 'Pay Now' button and FDCPA footer."""}],
            )
            email_body = comp.choices[0].message.content or ""
            email_body = email_body.replace("```html", "").replace("```", "").strip()
        else:
            email_body = f"""<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;"><div style="background:#1e3a5f;padding:24px;text-align:center;"><h2 style="margin:0;color:white;">Action Required: Outstanding Balance</h2></div><div style="padding:32px;"><p>Dear <strong>{customer.get('name')}</strong>,</p><p>Your outstanding balance of <strong>₹{account.get('outstandingAmount'):,.2f}</strong> is <strong>{account.get('daysOverdue')} days overdue</strong>.</p><div style="background:#f0f9ff;border-left:4px solid #2563eb;padding:16px;margin:24px 0;"><h3 style="margin-top:0;">Proposed Resolution: {body.recommendedAction}</h3><p style="margin-bottom:0;">{body.paymentSchedule}</p></div><div style="text-align:center;margin:32px 0;"><a href="#" style="background:#2563eb;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Pay Now</a></div><p style="font-size:11px;color:#6b7280;">This is an attempt to collect a debt.</p></div></div>"""

        return {"emailBody": email_body}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email generation failed: {str(e)}")


@router.post("/repayment-plan")
async def negotiate_repayment_plan(body: RepaymentPlanRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    start = time.time()
    try:
        oid = ObjectId(body.customerId)
        account = await db["accounts"].find_one({"customerId": oid})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        outstanding = account.get("outstandingAmount", 0)
        if is_groq_enabled():
            client = get_groq_client()
            comp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "Repayment plan evaluator. If proposed amount clears debt in ≤6 months: Accepted. Otherwise Counter Offer (4 months). JSON: {\"status\":\"Accepted\",\"approvedMonthlyAmount\":0,\"durationMonths\":0,\"reasoning\":\"\"}"},
                    {"role": "user", "content": f"Outstanding: ₹{outstanding}. Proposed: ₹{body.proposedAmount}/month. Hardship: {body.hardshipReason or 'None'}"},
                ],
            )
            result = json.loads(comp.choices[0].message.content or "{}")
        else:
            min_accept = outstanding / 6
            if body.proposedAmount >= min_accept:
                dur = int(outstanding / body.proposedAmount) + 1
                result = {"status": "Accepted", "approvedMonthlyAmount": body.proposedAmount, "durationMonths": dur, "reasoning": "Proposed amount clears debt within 6 months."}
            else:
                counter = round(outstanding / 4, 2)
                result = {"status": "Counter Offer", "approvedMonthlyAmount": counter, "durationMonths": 4, "reasoning": "Proposed too low. Offering 4-month plan."}

        if result.get("status") == "Accepted":
            now = datetime.utcnow()
            schedule = []
            current = now
            for _ in range(result["durationMonths"]):
                current = datetime(current.year + (current.month // 12), ((current.month % 12) + 1), current.day)
                schedule.append({"dueDate": current, "amount": result["approvedMonthlyAmount"], "status": "Unpaid"})
            await db["paymentplans"].insert_one({
                "customerId": oid, "totalAmount": outstanding, "emiAmount": result["approvedMonthlyAmount"],
                "frequency": "Monthly", "installmentsCount": result["durationMonths"],
                "paidInstallmentsCount": 0, "startDate": now, "status": "Active",
                "schedule": schedule, "createdAt": now, "updatedAt": now
            })
            await db["customers"].update_one({"_id": oid}, {"$set": {"status": "Active", "updatedAt": now}})

        await _save_agent_log(db, "Repayment Plans", "Success", body.model_dump(), result, int((time.time()-start)*1000))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Repayment negotiation failed: {str(e)}")


@router.post("/dispute")
async def handle_dispute(body: DisputeRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    start = time.time()
    try:
        oid = ObjectId(body.customerId)
        account = await db["accounts"].find_one({"customerId": oid})
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        if is_groq_enabled():
            client = get_groq_client()
            comp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "Dispute handler. JSON: {\"action\":\"Provide Evidence|Escalate to Officer|Dismiss\",\"responseToCustomer\":\"...\"}"},
                    {"role": "user", "content": f"Dispute: \"{body.disputeReason}\". Outstanding: ₹{account.get('outstandingAmount')}"},
                ],
            )
            result = json.loads(comp.choices[0].message.content or "{}")
        else:
            if any(w in body.disputeReason.lower() for w in ["legal", "sue", "lawyer"]):
                result = {"action": "Escalate to Officer", "responseToCustomer": "We take this seriously and have escalated to a senior officer."}
            else:
                result = {"action": "Provide Evidence", "responseToCustomer": "Please provide receipts or bank statements to support your claim."}

        now = datetime.utcnow()
        if result.get("action") == "Escalate to Officer":
            await db["escalations"].insert_one({"customerId": oid, "reason": f"Dispute: {body.disputeReason}", "severity": "High", "status": "Pending", "createdAt": now})
            await db["customers"].update_one({"_id": oid}, {"$set": {"status": "Escalated", "updatedAt": now}})
        else:
            await db["customers"].update_one({"_id": oid}, {"$set": {"status": "Disputed", "updatedAt": now}})

        await _save_agent_log(db, "Dispute Management", "Success", body.model_dump(), result, int((time.time()-start)*1000))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dispute handling failed: {str(e)}")


@router.post("/analytics-report")
async def generate_analytics(body: AnalyticsRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    start = time.time()
    try:
        if is_groq_enabled() and body.metrics:
            client = get_groq_client()
            comp = client.chat.completions.create(
                model="llama-3.3-70b-versatile", temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "Analytics agent. Write 2-3 sentence executive summary of performance metrics. JSON: {\"executiveSummary\":\"...\"}"},
                    {"role": "user", "content": f"Metrics: {json.dumps(body.metrics)}"},
                ],
            )
            result = json.loads(comp.choices[0].message.content or "{}")
        else:
            result = {"executiveSummary": "System performance remains stable. Automated agents are actively processing the queue, leading to consistent recovery rates."}

        await _save_agent_log(db, "Analytics & Report", "Success", {"metrics": body.metrics}, result, int((time.time()-start)*1000))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics failed: {str(e)}")


@router.get("/logs")
async def get_agent_logs(current_user: dict = Depends(get_current_user)):
    db = get_db()
    logs_cursor = db["agentlogs"].find().sort("createdAt", -1).limit(100)
    logs = []
    async for log in logs_cursor:
        log["id"] = str(log.pop("_id"))
        if "createdAt" in log and isinstance(log["createdAt"], datetime):
            log["createdAt"] = log["createdAt"].isoformat() + "Z"
        if isinstance(log.get("requestDetails"), dict):
            for k, v in log["requestDetails"].items():
                if isinstance(v, ObjectId):
                    log["requestDetails"][k] = str(v)
        logs.append(log)

    # Aggregate metrics per agent
    pipeline_agg = [
        {"$group": {"_id": "$agentName", "totalCalls": {"$sum": 1},
                    "successCount": {"$sum": {"$cond": [{"$eq": ["$status", "Success"]}, 1, 0]}},
                    "avgDuration": {"$avg": "$durationMs"}}}
    ]
    metrics = []
    async for m in db["agentlogs"].aggregate(pipeline_agg):
        metrics.append(m)

    return {"logs": logs, "metrics": metrics}
