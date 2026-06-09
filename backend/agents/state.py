from typing import TypedDict, Optional, List, Any


class BadDebtState(TypedDict):
    """
    Shared state that flows through every node of the Bad Debt Collection pipeline.
    Each agent reads from this state and writes its results back into it.
    """
    # ── Input: Customer & Account context ──────────────────────────────────────
    customer_id: str
    customer_name: str
    customer_email: str
    customer_phone: str
    customer_status: str
    outstanding_amount: float
    days_overdue: int
    risk_score: int
    contact_history: List[Any]
    payment_history: List[Any]
    assigned_officer_id: Optional[str]
    assigned_officer_email: Optional[str]

    # ── Node 1: Account Screening Agent ────────────────────────────────────────
    screening_result: Optional[dict]  # {eligible, priority, recommended_next_step, reasoning}

    # ── Node 2: Contact Strategy Agent ────────────────────────────────────────
    contact_strategy: Optional[dict]  # {channel, tone, message_template, best_time}

    # ── Node 3: Outreach Automation Agent ─────────────────────────────────────
    outreach_result: Optional[dict]   # {sent, channel, message_id, follow_up_scheduled}

    # ── Node 4: Payment Plan Agent ────────────────────────────────────────────
    payment_plan_result: Optional[dict]  # {status, approved_monthly, duration, reasoning}

    # ── Node 5: Human Collection Agent ────────────────────────────────────────
    human_collection_result: Optional[dict]  # {email_sent, calendar_event_id, notes}

    # ── Node 6: Status Update Agent ───────────────────────────────────────────
    status_update_result: Optional[dict]  # {customer_status_updated, sheets_updated, logs}

    # ── Node 7: Compliance & Reporting Agent ──────────────────────────────────
    compliance_report: Optional[dict]  # {compliant, report_url, summary}

    # ── Routing / Control flags ────────────────────────────────────────────────
    should_offer_payment_plan: bool    # Outreach → Payment Plan branch
    needs_human_agent: bool            # Route through Human Collection Agent
    pipeline_complete: bool
    error_message: Optional[str]

    # ── Pipeline metadata ─────────────────────────────────────────────────────
    pipeline_run_id: Optional[str]     # UUID for this pipeline run
    pipeline_logs: List[str]           # Accumulated log entries from each node
