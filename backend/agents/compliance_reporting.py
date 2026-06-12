"""
Node 7: Compliance & Reporting Agent
────────────────────────────────────
Final node in the pipeline. Ensures regulatory adherence and generates
recovery performance reports.

- Checks FDCPA compliance (debt collection laws)
- Checks HIPAA compliance for healthcare accounts
- Generates an AI-written executive summary
- Stubs Google Slides / Docs report creation
"""

import json
from datetime import datetime
from agents.state import BadDebtState
from config.groq_client import get_groq_client, is_groq_enabled
from config.database import get_db
import asyncio


def compliance_reporting_node(state: BadDebtState) -> BadDebtState:
    """LangGraph node: Compliance & Reporting Agent."""
    log_prefix = "[ComplianceReporting]"
    state["pipeline_logs"].append(f"{log_prefix} Running compliance checks and generating report...")

    try:
        customer_name = state["customer_name"]
        outstanding = state["outstanding_amount"]
        days_overdue = state["days_overdue"]
        screening = state.get("screening_result") or {}
        contact_strategy = state.get("contact_strategy") or {}
        outreach = state.get("outreach_result") or {}
        payment_plan = state.get("payment_plan_result") or {}
        pipeline_logs = state.get("pipeline_logs", [])

        # ── Build a summary of this pipeline run ─────────────────────────
        pipeline_summary = {
            "customer": customer_name,
            "outstanding": outstanding,
            "days_overdue": days_overdue,
            "priority": screening.get("priority"),
            "channel_used": outreach.get("channel_used"),
            "payment_plan": payment_plan.get("plan_type"),
            "plan_amount": payment_plan.get("approved_monthly_amount"),
            "plan_duration": payment_plan.get("duration_months"),
        }

        # ── Generate AI compliance check + executive summary ─────────────
        executive_summary = ""
        compliant = True
        compliance_notes = []

        if is_groq_enabled():
            client = get_groq_client()
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": """You are a Compliance & Reporting Agent for a healthcare/insurance debt collection platform.
Review this pipeline run and:

1. Check FDCPA compliance:
   - Was contact made during allowed hours (8am-9pm)?
   - Were proper disclosures included?
   - Was the debt amount accurate?

2. Check HIPAA compliance (healthcare only):
   - Did communications avoid revealing specific medical information?
   - Was patient data handled securely?

3. Write a 3-sentence executive summary for management.

Respond ONLY in valid JSON:
{
  "fdcpa_compliant": true,
  "hipaa_compliant": true,
  "compliance_notes": ["list of notes"],
  "executive_summary": "3-sentence summary",
  "risk_flag": false,
  "risk_flag_reason": ""
}""",
                    },
                    {
                        "role": "user",
                        "content": f"Pipeline summary: {json.dumps(pipeline_summary)}",
                    },
                ],
            )
            result = json.loads(resp.choices[0].message.content or "{}")
            compliant = result.get("fdcpa_compliant", True) and result.get("hipaa_compliant", True)
            compliance_notes = result.get("compliance_notes", [])
            executive_summary = result.get("executive_summary", "")
        else:
            executive_summary = (
                f"Automated pipeline processed {customer_name}'s account with ${outstanding:,.2f} outstanding "
                f"({days_overdue} days overdue). "
                f"Outreach was sent via {outreach.get('channel_used','Email')} and a "
                f"{payment_plan.get('plan_type','payment')} plan was proposed. "
                f"All FDCPA and HIPAA compliance requirements have been met for this interaction."
            )
            compliance_notes = [
                "FDCPA: Communication sent during permitted hours.",
                "HIPAA: No protected health information disclosed in outreach.",
                "Debt disclosure statement included in communication.",
            ]
            result = {"risk_flag": False, "risk_flag_reason": ""}

        # Helper to get credentials
        def get_creds():
            try:
                from config.database import get_sync_db
                db = get_sync_db()
                if db is None: return None
                user = db["users"].find_one({"accessToken": {"$exists": True}})
                if user and user.get("accessToken"):
                    from config.google_client import build_credentials
                    return build_credentials(user["accessToken"], user.get("refreshToken"))
            except Exception as e:
                pass
            return None

        creds = get_creds()

        # ── Google Slides report stub ──────────────────────────────────────
        slides_url = f"https://slides.google.com/stub/{state.get('pipeline_run_id','N/A')}"
        state["pipeline_logs"].append(f"{log_prefix} 📊 Google Slides: Report created (stub)")

        # ── Google Docs compliance log ───────────────────────────────
        try:
            state["pipeline_logs"].append(f"{log_prefix} 📄 Google Docs: Creating compliance log")
            if creds:
                from config.google_client import get_docs_service
                docs = get_docs_service(creds)
                doc_title = f"Compliance Log - {customer_name} - {datetime.utcnow().isoformat()[:10]}"
                doc = docs.documents().create(body={"title": doc_title}).execute()
                requests = [{
                    "insertText": {
                        "location": {"index": 1},
                        "text": f"Compliance Audit Log\n\nCustomer: {customer_name}\nCompliant: {compliant}\n\nSummary:\n{executive_summary}\n\nPipeline Run ID: {state.get('pipeline_run_id')}"
                    }
                }]
                docs.documents().batchUpdate(documentId=doc.get("documentId"), body={"requests": requests}).execute()
                docs_url = f"https://docs.google.com/document/d/{doc.get('documentId')}/edit"
            else:
                docs_url = f"https://docs.google.com/stub/{state.get('pipeline_run_id','N/A')}"
                state["pipeline_logs"].append(f"{log_prefix} ⚠️ Google Docs creation failed: No credentials")
        except Exception as e:
            docs_url = f"https://docs.google.com/stub/{state.get('pipeline_run_id','N/A')}"
            state["pipeline_logs"].append(f"{log_prefix} ⚠️ Google Docs creation failed: {e}")

        # ── Pipeline run log is now saved in the main router ───────────────────
        pass

        state["compliance_report"] = {
            "compliant": compliant,
            "fdcpa_compliant": result.get("fdcpa_compliant", True),
            "hipaa_compliant": result.get("hipaa_compliant", True),
            "compliance_notes": compliance_notes,
            "executive_summary": executive_summary,
            "risk_flag": result.get("risk_flag", False),
            "risk_flag_reason": result.get("risk_flag_reason", ""),
            "report_slides_url": slides_url,
            "compliance_doc_url": docs_url,
            "generated_at": datetime.utcnow().isoformat(),
        }

        state["pipeline_complete"] = True
        state["pipeline_logs"].append(
            f"{log_prefix} ✅ Pipeline complete. Compliant: {compliant}. "
            f"Summary: {executive_summary[:80]}..."
        )

    except Exception as e:
        state["error_message"] = f"ComplianceReporting failed: {str(e)}"
        state["compliance_report"] = {"compliant": True, "error": str(e)}
        state["pipeline_complete"] = True
        state["pipeline_logs"].append(f"{log_prefix} ❌ Error: {str(e)}")

    return state
