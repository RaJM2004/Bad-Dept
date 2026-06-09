"""
Node 4: Payment Plan Agent
────────────────────────────
Negotiates an EMI plan for the customer. Uses Groq to evaluate whether
a proposed payment schedule is acceptable. Saves accepted plans to MongoDB.

After negotiation, routes to the Human Collection Agent for officer notification.
"""

import json
import asyncio
from datetime import datetime, timedelta
from agents.state import BadDebtState
from config.groq_client import get_groq_client, is_groq_enabled
from config.database import get_db


def payment_plan_node(state: BadDebtState) -> BadDebtState:
    """LangGraph node: Payment Plan Agent."""
    log_prefix = "[PaymentPlan]"
    state["pipeline_logs"].append(f"{log_prefix} Negotiating payment plan...")

    try:
        outstanding = state["outstanding_amount"]
        days_overdue = state["days_overdue"]
        risk_score = state["risk_score"]
        customer_id = state["customer_id"]

        if is_groq_enabled():
            client = get_groq_client()
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": """You are a Payment Plan Agent for a healthcare/insurance debt collection platform.
Evaluate the best EMI plan for this account:
- If 30-60 days overdue: suggest 3-month plan (customer pays 33% per month)
- If 60-90 days overdue: suggest 4-month plan (25% per month)
- If >90 days overdue: suggest a 30% settlement discount OR a 6-month plan
- Risk score >80: lean towards settlement
- For healthcare: note that insurance may cover part of the outstanding balance

Respond ONLY in valid JSON:
{
  "status": "Accepted",
  "plan_type": "EMI",
  "approved_monthly_amount": 500.0,
  "duration_months": 3,
  "total_payable": 1500.0,
  "discount_percent": 0,
  "settlement_offer": false,
  "reasoning": "string",
  "first_payment_due": "2024-08-01"
}""",
                    },
                    {
                        "role": "user",
                        "content": f"Outstanding: ${outstanding} | Days Overdue: {days_overdue} | Risk Score: {risk_score}/100",
                    },
                ],
            )
            result = json.loads(resp.choices[0].message.content or "{}")
        else:
            # Mock payment plan logic
            if days_overdue > 90 or risk_score > 80:
                discount = 30
                settlement_amt = round(outstanding * 0.7, 2)
                result = {
                    "status": "Accepted",
                    "plan_type": "Settlement",
                    "approved_monthly_amount": settlement_amt,
                    "duration_months": 1,
                    "total_payable": settlement_amt,
                    "discount_percent": discount,
                    "settlement_offer": True,
                    "reasoning": f"High-risk account ({days_overdue} days). Offering 30% settlement.",
                    "first_payment_due": (datetime.utcnow() + timedelta(days=10)).strftime("%Y-%m-%d"),
                }
            elif days_overdue > 60:
                monthly = round(outstanding / 4, 2)
                result = {
                    "status": "Accepted",
                    "plan_type": "EMI",
                    "approved_monthly_amount": monthly,
                    "duration_months": 4,
                    "total_payable": outstanding,
                    "discount_percent": 0,
                    "settlement_offer": False,
                    "reasoning": f"4-month EMI plan. ${monthly}/month.",
                    "first_payment_due": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d"),
                }
            else:
                monthly = round(outstanding / 3, 2)
                result = {
                    "status": "Accepted",
                    "plan_type": "EMI",
                    "approved_monthly_amount": monthly,
                    "duration_months": 3,
                    "total_payable": outstanding,
                    "discount_percent": 0,
                    "settlement_offer": False,
                    "reasoning": f"3-month EMI plan. ${monthly}/month.",
                    "first_payment_due": (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d"),
                }

        # ── Persist to MongoDB asynchronously ─────────────────────────────
        # We use asyncio.create_task to save without blocking the sync node
        if result.get("status") == "Accepted":
            try:
                db = get_db()
                if db:
                    duration = result.get("duration_months", 3)
                    monthly_amt = result.get("approved_monthly_amount", outstanding)
                    schedule = []
                    current = datetime.utcnow()
                    for i in range(duration):
                        current = current + timedelta(days=30)
                        schedule.append({
                            "due_date": current,
                            "amount": monthly_amt,
                            "status": "Unpaid",
                        })

                    from bson import ObjectId
                    plan_doc = {
                        "customerId": ObjectId(customer_id),
                        "totalAmount": outstanding,
                        "emiAmount": monthly_amt,
                        "frequency": "Monthly",
                        "installmentsCount": duration,
                        "paidInstallmentsCount": 0,
                        "startDate": datetime.utcnow(),
                        "status": "Active",
                        "schedule": schedule,
                        "createdAt": datetime.utcnow(),
                        "updatedAt": datetime.utcnow(),
                    }

                    loop = asyncio.new_event_loop()
                    loop.run_until_complete(db["paymentplans"].insert_one(plan_doc))
                    loop.close()
                    state["pipeline_logs"].append(f"{log_prefix} 💾 Payment plan saved to MongoDB")
            except Exception as db_err:
                state["pipeline_logs"].append(f"{log_prefix} ⚠️ Could not save plan to DB: {db_err}")

        state["payment_plan_result"] = result
        # After payment plan, always route through human collection for officer awareness
        state["needs_human_agent"] = True

        state["pipeline_logs"].append(
            f"{log_prefix} ✅ Plan: {result.get('plan_type')} | "
            f"${result.get('approved_monthly_amount')}/mo × {result.get('duration_months')} months"
        )

    except Exception as e:
        state["error_message"] = f"PaymentPlan failed: {str(e)}"
        state["payment_plan_result"] = {"status": "Error", "error": str(e)}
        state["needs_human_agent"] = True
        state["pipeline_logs"].append(f"{log_prefix} ❌ Error: {str(e)}")

    return state
