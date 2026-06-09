"""
Node 2: Contact Strategy Agent
────────────────────────────────
Generates a personalized outreach plan based on:
  - Customer communication history and preferences
  - Risk score and overdue days
  - Industry context (healthcare / insurance)
  - Previous contact attempts

Outputs: preferred channel (Email/SMS/IVR), tone, and a ready-to-use message template.
"""

import json
from agents.state import BadDebtState
from config.groq_client import get_groq_client, is_groq_enabled


def contact_strategy_node(state: BadDebtState) -> BadDebtState:
    """LangGraph node: Contact Strategy Agent."""
    log_prefix = "[ContactStrategy]"
    state["pipeline_logs"].append(f"{log_prefix} Building personalized contact strategy...")

    try:
        screening = state.get("screening_result", {})
        priority = screening.get("priority", "Medium")
        days_overdue = state["days_overdue"]
        outstanding = state["outstanding_amount"]
        contact_history = state["contact_history"]
        customer_name = state["customer_name"]
        customer_email = state["customer_email"]

        # Count previous contact attempts by channel
        prev_emails = sum(1 for c in contact_history if c.get("channel") == "Email")
        prev_sms = sum(1 for c in contact_history if c.get("channel") == "SMS")
        prev_calls = sum(1 for c in contact_history if c.get("channel") == "Call")

        if is_groq_enabled():
            client = get_groq_client()
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": """You are a Contact Strategy Agent for a healthcare/insurance debt collection platform.
Your job is to decide the BEST outreach approach for this account.

Guidelines:
- If no prior contact: start with Email (least disruptive)
- If 1-2 prior emails: escalate to SMS
- If 3+ attempts and still unpaid: recommend IVR or direct call
- Tone should match priority: High → Firm & Urgent, Medium → Empathetic, Low → Friendly reminder
- For healthcare: always mention patient billing department, be HIPAA-aware (no specific diagnosis info)
- For insurance: reference policy number / claim ID if available

Respond ONLY in valid JSON:
{
  "preferred_channel": "Email",
  "tone": "Empathetic",
  "urgency_level": "Medium",
  "best_contact_time": "9 AM - 12 PM",
  "message_template": "Dear {name}, ...",
  "subject_line": "Payment Reminder – Outstanding Balance of ${amount}",
  "follow_up_in_days": 7,
  "reasoning": "string"
}""",
                    },
                    {
                        "role": "user",
                        "content": f"""Customer: {customer_name} | Email: {customer_email}
Outstanding: ${outstanding} | Days Overdue: {days_overdue} | Priority: {priority}
Prior Contact: {prev_emails} emails, {prev_sms} SMS, {prev_calls} calls""",
                    },
                ],
            )
            result = json.loads(resp.choices[0].message.content or "{}")
        else:
            # Mock contact strategy
            if prev_emails == 0:
                channel = "Email"
            elif prev_sms == 0:
                channel = "SMS"
            else:
                channel = "Call"

            tone = "Firm & Urgent" if priority == "High" else "Empathetic" if priority == "Medium" else "Friendly"
            result = {
                "preferred_channel": channel,
                "tone": tone,
                "urgency_level": priority,
                "best_contact_time": "9 AM - 12 PM",
                "message_template": f"Dear {customer_name}, this is a reminder regarding your outstanding balance of ${outstanding}. Please contact us to arrange payment.",
                "subject_line": f"Payment Reminder – Outstanding Balance of ${outstanding}",
                "follow_up_in_days": 3 if priority == "High" else 7,
                "reasoning": f"Previous contact attempts: {len(contact_history)}. Moving to {channel}.",
            }

        state["contact_strategy"] = result
        state["pipeline_logs"].append(
            f"{log_prefix} ✅ Strategy: {result.get('preferred_channel')} | "
            f"Tone: {result.get('tone')} | Follow-up in {result.get('follow_up_in_days')} days"
        )

    except Exception as e:
        state["error_message"] = f"ContactStrategy failed: {str(e)}"
        state["contact_strategy"] = {
            "preferred_channel": "Email",
            "tone": "Empathetic",
            "urgency_level": "Medium",
            "best_contact_time": "9 AM - 5 PM",
            "message_template": f"Dear {state['customer_name']}, please contact us regarding your outstanding balance.",
            "subject_line": "Payment Reminder",
            "follow_up_in_days": 7,
            "reasoning": "Default strategy applied due to error.",
        }
        state["pipeline_logs"].append(f"{log_prefix} ❌ Error: {str(e)}. Using defaults.")

    return state
