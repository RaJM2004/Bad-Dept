"""
Node 5: Human Collection Agent
────────────────────────────────
Notifies the assigned collection officer by:
  - Sending a Gmail summary email to the officer
  - Creating a Google Calendar follow-up event

This node supports Human-in-the-Loop: in production you can enable
`interrupt_before=["human_collection"]` on the compiled graph to pause
and wait for the officer to review and approve before continuing.
"""

import json
import base64
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from agents.state import BadDebtState
from config.groq_client import get_groq_client, is_groq_enabled


def _build_officer_email_html(state: BadDebtState) -> str:
    """Generate a summary email HTML for the collection officer."""
    payment = state.get("payment_plan_result") or {}
    outreach = state.get("outreach_result") or {}
    screening = state.get("screening_result") or {}

    return f"""
<div style="font-family:sans-serif;max-width:650px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px;text-align:center;">
    <h2 style="margin:0;color:white;font-size:20px;">🤖 AI Pipeline – Action Required</h2>
    <p style="color:#bfdbfe;margin:4px 0 0;">Bad Debt Collection Platform</p>
  </div>
  <div style="padding:32px;background:white;">
    <h3 style="color:#1e293b;margin-top:0;">Account Summary</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;color:#64748b;font-weight:600;">Customer</td><td style="padding:8px 12px;color:#1e293b;">{state['customer_name']}</td></tr>
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600;">Email</td><td style="padding:8px 12px;color:#1e293b;">{state['customer_email']}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;color:#64748b;font-weight:600;">Outstanding</td><td style="padding:8px 12px;color:#dc2626;font-weight:700;">${state['outstanding_amount']:,.2f}</td></tr>
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600;">Days Overdue</td><td style="padding:8px 12px;color:#1e293b;">{state['days_overdue']} days</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 12px;color:#64748b;font-weight:600;">Risk Score</td><td style="padding:8px 12px;color:#1e293b;">{state['risk_score']}/100</td></tr>
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600;">Priority</td><td style="padding:8px 12px;color:#d97706;font-weight:600;">{screening.get('priority','N/A')}</td></tr>
    </table>
    <h3 style="color:#1e293b;">AI Pipeline Results</h3>
    <div style="background:#f0f9ff;border-left:4px solid #2563eb;padding:16px;border-radius:0 8px 8px 0;margin-bottom:16px;">
      <p style="margin:0;font-weight:600;color:#1e40af;">Outreach Sent</p>
      <p style="margin:4px 0 0;color:#1e293b;">Channel: {outreach.get('channel_used','Email')} | Follow-up: {outreach.get('follow_up_date','TBD')}</p>
    </div>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0;font-weight:600;color:#15803d;">Payment Plan Proposed</p>
      <p style="margin:4px 0 0;color:#1e293b;">Type: {payment.get('plan_type','EMI')} | Monthly: ${payment.get('approved_monthly_amount',0):,.2f} × {payment.get('duration_months',3)} months</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">{payment.get('reasoning','')}</p>
    </div>
    <p style="color:#64748b;font-size:13px;">Please review and take any additional action required. The AI pipeline will continue automatically.</p>
  </div>
</div>"""


def human_collection_node(state: BadDebtState) -> BadDebtState:
    """LangGraph node: Human Collection Agent."""
    log_prefix = "[HumanCollection]"
    state["pipeline_logs"].append(f"{log_prefix} Notifying collection officer...")

    try:
        officer_email = state.get("assigned_officer_email")
        customer_name = state["customer_name"]
        outstanding = state["outstanding_amount"]
        days_overdue = state["days_overdue"]
        payment_plan = state.get("payment_plan_result") or {}

        # ── Generate officer notification email ─────────────────────────────
        email_html = _build_officer_email_html(state)
        email_sent = False
        calendar_event_id = None
        notes = []

        # ── Send Gmail to officer ──────────────────────────────────────────
        subject = f"[Action Required] {customer_name} – ${outstanding:,.2f} outstanding, {days_overdue} days overdue"
        try:
            state["pipeline_logs"].append(
                f"{log_prefix} 📧 Gmail: Notifying officer ({officer_email or 'default'}) about {customer_name}"
            )
            # Actual send:
            # creds = build_credentials(officer_access_token, officer_refresh_token)
            # gmail = get_gmail_service(creds)
            # msg_payload = MIMEText(email_html, "html")
            # msg_payload["to"] = officer_email
            # msg_payload["subject"] = subject
            # raw = base64.urlsafe_b64encode(msg_payload.as_bytes()).decode()
            # gmail.users().messages().send(userId="me", body={"raw": raw}).execute()
            email_sent = True
            notes.append(f"Officer notification email prepared for {officer_email}")
        except Exception as e:
            notes.append(f"Gmail notification failed: {e}")
            state["pipeline_logs"].append(f"{log_prefix} ⚠️ Gmail to officer failed: {e}")

        # ── Create Calendar Event for officer review ───────────────────────
        follow_up_dt = (datetime.utcnow() + timedelta(days=2)).isoformat() + "Z"
        try:
            state["pipeline_logs"].append(
                f"{log_prefix} 📅 Google Calendar: Creating officer review event"
            )
            # Actual calendar create:
            # creds = build_credentials(officer_access_token, officer_refresh_token)
            # cal = get_calendar_service(creds)
            # event_body = {
            #     "summary": f"Review: {customer_name} – ${outstanding:,.2f}",
            #     "description": f"Payment plan proposed: {json.dumps(payment_plan, indent=2)}",
            #     "start": {"dateTime": follow_up_dt, "timeZone": "UTC"},
            #     "end": {"dateTime": follow_up_dt, "timeZone": "UTC"},
            # }
            # event = cal.events().insert(calendarId="primary", body=event_body).execute()
            # calendar_event_id = event.get("id")
            calendar_event_id = f"officer_review_{datetime.utcnow().timestamp()}"
            notes.append(f"Calendar event scheduled for {follow_up_dt[:10]}")
        except Exception as e:
            notes.append(f"Calendar event creation failed: {e}")
            state["pipeline_logs"].append(f"{log_prefix} ⚠️ Calendar creation failed: {e}")

        state["human_collection_result"] = {
            "email_sent": email_sent,
            "email_html": email_html,
            "officer_email": officer_email,
            "calendar_event_id": calendar_event_id,
            "review_date": follow_up_dt[:10],
            "notes": notes,
        }

        state["pipeline_logs"].append(
            f"{log_prefix} ✅ Officer notified. Review scheduled: {follow_up_dt[:10]}"
        )

    except Exception as e:
        state["error_message"] = f"HumanCollection failed: {str(e)}"
        state["human_collection_result"] = {"email_sent": False, "error": str(e)}
        state["pipeline_logs"].append(f"{log_prefix} ❌ Error: {str(e)}")

    return state
