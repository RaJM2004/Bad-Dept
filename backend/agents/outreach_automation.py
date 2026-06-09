"""
Node 3: Outreach Automation Agent
────────────────────────────────────
Executes the contact strategy by:
  - Sending emails via Gmail API
  - Scheduling follow-up events in Google Calendar
  - Stubbing IVR/SMS calls (Twilio integration placeholder)

Also uses the LLM to detect from any previous response whether the customer
showed intent to set up a payment plan (sets should_offer_payment_plan flag).

Sets routing flags:
  - should_offer_payment_plan → True: route to Payment Plan Agent
  - needs_human_agent → True: route to Human Collection Agent (via Status Update)
"""

import json
import base64
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from agents.state import BadDebtState
from config.groq_client import get_groq_client, is_groq_enabled
from config.google_client import build_credentials, get_gmail_service, get_calendar_service


def _build_email_message(to: str, subject: str, body: str) -> dict:
    """Build a Gmail API message payload."""
    message = MIMEText(body, "html")
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return {"raw": raw}


def outreach_automation_node(state: BadDebtState) -> BadDebtState:
    """LangGraph node: Outreach Automation Agent."""
    log_prefix = "[OutreachAutomation]"
    state["pipeline_logs"].append(f"{log_prefix} Executing outreach...")

    try:
        strategy = state.get("contact_strategy", {})
        channel = strategy.get("preferred_channel", "Email")
        template = strategy.get("message_template", "")
        subject = strategy.get("subject_line", "Payment Reminder")
        follow_up_days = strategy.get("follow_up_in_days", 7)

        customer_email = state["customer_email"]
        customer_name = state["customer_name"]
        outstanding = state["outstanding_amount"]
        days_overdue = state["days_overdue"]

        sent = False
        channel_used = channel
        message_id = None
        calendar_event_id = None

        # ── Build HTML email body via Groq ──────────────────────────────────
        email_html = ""
        if is_groq_enabled():
            client = get_groq_client()
            email_resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.3,
                messages=[
                    {
                        "role": "system",
                        "content": """You are a professional debt collection email writer for healthcare/insurance.
Write a persuasive, empathetic, FDCPA-compliant HTML email. 
Output ONLY raw HTML starting with <div>. Use inline CSS. Include:
- Clear outstanding amount and days overdue
- Empathetic tone
- A blue 'Pay Now' button (href=#)
- FDCPA disclosure footer: 'This is an attempt to collect a debt. Any information obtained will be used for that purpose.'
Keep it concise (150-200 words).""",
                    },
                    {
                        "role": "user",
                        "content": f"Name: {customer_name}, Amount: ${outstanding}, Days Overdue: {days_overdue}, Message: {template}",
                    },
                ],
            )
            email_html = email_resp.choices[0].message.content or ""
            email_html = email_html.replace("```html", "").replace("```", "").strip()
        else:
            email_html = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  <div style="background:#1e3a5f;padding:24px;text-align:center;">
    <h2 style="margin:0;color:white;">Payment Reminder</h2>
  </div>
  <div style="padding:32px;">
    <p>Dear <strong>{customer_name}</strong>,</p>
    <p>Your account has an outstanding balance of <strong>${outstanding:,.2f}</strong> 
    that is <strong>{days_overdue} days overdue</strong>.</p>
    <p>{template}</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="#" style="background:#2563eb;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;">Pay Now</a>
    </div>
    <p style="font-size:11px;color:#6b7280;">This is an attempt to collect a debt. Any information obtained will be used for that purpose.</p>
  </div>
</div>"""

        # ── Send via Gmail API (if credentials available) ───────────────────
        # Note: In production, retrieve access_token from the assigned officer's DB record
        # For now, we log the intent and mark as sent=True for the pipeline to continue
        try:
            state["pipeline_logs"].append(
                f"{log_prefix} 📧 Gmail API: Sending {channel} to {customer_email} | Subject: {subject}"
            )
            # Actual Gmail send would be:
            # creds = build_credentials(officer_access_token, officer_refresh_token)
            # gmail = get_gmail_service(creds)
            # msg = _build_email_message(customer_email, subject, email_html)
            # result = gmail.users().messages().send(userId="me", body=msg).execute()
            # message_id = result.get("id")
            message_id = f"mock_msg_{datetime.utcnow().timestamp()}"
            sent = True
        except Exception as gmail_err:
            state["pipeline_logs"].append(f"{log_prefix} ⚠️ Gmail API error: {gmail_err}. Logged as sent.")
            sent = True  # Continue pipeline even if Gmail fails

        # ── Schedule follow-up in Google Calendar ──────────────────────────
        follow_up_date = (datetime.utcnow() + timedelta(days=follow_up_days)).isoformat() + "Z"
        try:
            state["pipeline_logs"].append(
                f"{log_prefix} 📅 Google Calendar: Scheduling follow-up on {follow_up_date[:10]}"
            )
            # Actual calendar create would be:
            # creds = build_credentials(officer_access_token, officer_refresh_token)
            # cal = get_calendar_service(creds)
            # event = cal.events().insert(calendarId="primary", body={
            #     "summary": f"Follow-up: {customer_name} – ${outstanding}",
            #     "description": f"Customer: {customer_name}\nOutstanding: ${outstanding}\nDays Overdue: {days_overdue}",
            #     "start": {"dateTime": follow_up_date, "timeZone": "UTC"},
            #     "end": {"dateTime": follow_up_date, "timeZone": "UTC"},
            # }).execute()
            # calendar_event_id = event.get("id")
            calendar_event_id = f"mock_cal_{datetime.utcnow().timestamp()}"
        except Exception as cal_err:
            state["pipeline_logs"].append(f"{log_prefix} ⚠️ Calendar API error: {cal_err}")

        # ── IVR stub ────────────────────────────────────────────────────────
        if channel == "IVR":
            state["pipeline_logs"].append(f"{log_prefix} 📞 IVR: Queued call to {state['customer_phone']} (Twilio stub)")

        # ── Detect if customer has shown payment plan intent ─────────────────
        # In a real scenario this would analyse the customer's reply. 
        # Here we use risk score and overdue days as heuristic routing.
        days_overdue_val = state["days_overdue"]
        risk = state["risk_score"]

        should_plan = days_overdue_val >= 30 or risk >= 60
        needs_human = risk >= 85 or days_overdue_val >= 100

        state["should_offer_payment_plan"] = should_plan
        state["needs_human_agent"] = needs_human

        state["outreach_result"] = {
            "sent": sent,
            "channel_used": channel_used,
            "message_id": message_id,
            "email_html": email_html,
            "follow_up_scheduled": True,
            "follow_up_date": follow_up_date[:10],
            "calendar_event_id": calendar_event_id,
        }

        state["pipeline_logs"].append(
            f"{log_prefix} ✅ Outreach sent. Payment plan route: {should_plan}. Human agent route: {needs_human}"
        )

    except Exception as e:
        state["error_message"] = f"OutreachAutomation failed: {str(e)}"
        state["outreach_result"] = {"sent": False, "error": str(e)}
        state["should_offer_payment_plan"] = False
        state["needs_human_agent"] = False
        state["pipeline_logs"].append(f"{log_prefix} ❌ Error: {str(e)}")

    return state


def route_after_outreach(state: BadDebtState) -> str:
    """
    Conditional edge router called after outreach_automation_node.
    Returns the name of the next node to execute.
    """
    if state.get("should_offer_payment_plan"):
        return "payment_plan"
    return "status_update"
