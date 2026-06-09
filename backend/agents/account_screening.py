"""
Node 1: Account Screening Agent
────────────────────────────────
Reviews aging account data from MongoDB/Google Sheets and determines:
  - Whether the account is eligible for collections
  - Priority (High / Medium / Low)
  - Recommended next step (proceed / hold / legal)

Focused on healthcare & insurance industry rules (HIPAA, FDCPA compliance).
"""

import json
from agents.state import BadDebtState
from config.groq_client import get_groq_client, is_groq_enabled


def account_screening_node(state: BadDebtState) -> BadDebtState:
    """LangGraph node: Account Screening Agent."""
    log_prefix = "[AccountScreening]"
    state["pipeline_logs"].append(f"{log_prefix} Starting account eligibility review...")

    try:
        customer_name = state["customer_name"]
        outstanding = state["outstanding_amount"]
        days_overdue = state["days_overdue"]
        risk_score = state["risk_score"]
        payment_history = state["payment_history"]
        contact_history = state["contact_history"]

        if is_groq_enabled():
            client = get_groq_client()
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": """You are an Account Screening Agent for a bad debt collection platform 
focused on healthcare and insurance industries. Your job is to review a delinquent account 
and determine:
1. Whether it is eligible for collections (check FDCPA eligibility: >30 days overdue, amount > $50)
2. Priority level: High (>90 days or >$10k), Medium (30-90 days or $1k-$10k), Low (<30 days)
3. Recommended next step: 'Proceed to Contact', 'Hold – Needs Review', 'Refer to Legal'
4. Healthcare/insurance specific check: if payment history suggests insurance claim pending, flag it

Respond ONLY in valid JSON:
{
  "eligible": true,
  "priority": "High",
  "recommended_next_step": "Proceed to Contact",
  "reasoning": "string",
  "insurance_flag": false,
  "insurance_note": ""
}""",
                    },
                    {
                        "role": "user",
                        "content": f"""Customer: {customer_name}
Outstanding: ${outstanding}
Days Overdue: {days_overdue}
Risk Score: {risk_score}/100
Payment History ({len(payment_history)} entries): {json.dumps(payment_history[-3:] if payment_history else [])}
Contact History ({len(contact_history)} attempts): {len(contact_history)} previous contacts""",
                    },
                ],
            )
            result = json.loads(resp.choices[0].message.content or "{}")
        else:
            # Mock screening logic
            eligible = days_overdue >= 30 and outstanding > 50
            if days_overdue > 90 or outstanding > 10000:
                priority = "High"
            elif days_overdue > 30 or outstanding > 1000:
                priority = "Medium"
            else:
                priority = "Low"

            result = {
                "eligible": eligible,
                "priority": priority,
                "recommended_next_step": "Proceed to Contact" if eligible else "Hold – Needs Review",
                "reasoning": f"Account is {days_overdue} days overdue with ${outstanding} outstanding.",
                "insurance_flag": False,
                "insurance_note": "",
            }

        state["screening_result"] = result
        state["pipeline_logs"].append(
            f"{log_prefix} ✅ Screening complete. Priority: {result.get('priority')}. "
            f"Eligible: {result.get('eligible')}. Next: {result.get('recommended_next_step')}"
        )

    except Exception as e:
        state["error_message"] = f"AccountScreening failed: {str(e)}"
        state["screening_result"] = {
            "eligible": True,
            "priority": "Medium",
            "recommended_next_step": "Proceed to Contact",
            "reasoning": "Defaulting to proceed due to screening error.",
            "insurance_flag": False,
            "insurance_note": "",
        }
        state["pipeline_logs"].append(f"{log_prefix} ❌ Error: {str(e)}. Using defaults.")

    return state
