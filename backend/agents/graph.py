"""
LangGraph StateGraph – Bad Debt Collection Pipeline
──────────────────────────────────────────────────
Wires all 7 agent nodes into a directed graph matching the architecture
in the uploaded diagram:

    account_screening
          ↓
    contact_strategy
          ↓
    outreach_automation
          ↓ (conditional)
    ┌─────────────────────────┐
    │ should_offer_payment_plan│
    ├──True──┐                │
    │     payment_plan        │
    │         ↓               │
    │     human_collection    │
    │         ↓               │
    └──False──┘               │
          ↓                   │
    status_update             │
          ↓                   │
    compliance_reporting      │
          ↓                   │
         END                  │
"""

import uuid
from langgraph.graph import StateGraph, END
from agents.state import BadDebtState
from agents.account_screening import account_screening_node
from agents.contact_strategy import contact_strategy_node
from agents.outreach_automation import outreach_automation_node, route_after_outreach
from agents.payment_plan import payment_plan_node
from agents.human_collection import human_collection_node
from agents.status_update import status_update_node
from agents.compliance_reporting import compliance_reporting_node


# ── Build the graph ──────────────────────────────────────────────────────────
_graph_builder = StateGraph(BadDebtState)

# Register nodes
_graph_builder.add_node("account_screening", account_screening_node)
_graph_builder.add_node("contact_strategy_agent", contact_strategy_node)
_graph_builder.add_node("outreach_automation", outreach_automation_node)
_graph_builder.add_node("payment_plan", payment_plan_node)
_graph_builder.add_node("human_collection", human_collection_node)
_graph_builder.add_node("status_update", status_update_node)
_graph_builder.add_node("compliance_reporting", compliance_reporting_node)

# Entry point
_graph_builder.set_entry_point("account_screening")

# Fixed edges
_graph_builder.add_edge("account_screening", "contact_strategy_agent")
_graph_builder.add_edge("contact_strategy_agent", "outreach_automation")

# Conditional edge: after outreach → payment_plan OR status_update
_graph_builder.add_conditional_edges(
    "outreach_automation",
    route_after_outreach,
    {
        "payment_plan": "payment_plan",
        "status_update": "status_update",
    },
)

# After payment plan → human collection (officer notification)
_graph_builder.add_edge("payment_plan", "human_collection")
_graph_builder.add_edge("human_collection", "status_update")

# Final stretch
_graph_builder.add_edge("status_update", "compliance_reporting")
_graph_builder.add_edge("compliance_reporting", END)

# Compile the pipeline
# To enable human-in-the-loop (pause before human_collection):
#   pipeline = _graph_builder.compile(interrupt_before=["human_collection"])
pipeline = _graph_builder.compile()


def build_initial_state(
    customer_id: str,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    customer_status: str,
    outstanding_amount: float,
    days_overdue: int,
    risk_score: int,
    contact_history: list,
    payment_history: list,
    assigned_officer_id: str = None,
    assigned_officer_email: str = None,
) -> BadDebtState:
    """Build the initial LangGraph state from customer/account data."""
    return BadDebtState(
        customer_id=customer_id,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        customer_status=customer_status,
        outstanding_amount=outstanding_amount,
        days_overdue=days_overdue,
        risk_score=risk_score,
        contact_history=contact_history,
        payment_history=payment_history,
        assigned_officer_id=assigned_officer_id,
        assigned_officer_email=assigned_officer_email,
        # Outputs – start empty
        screening_result=None,
        contact_strategy=None,
        outreach_result=None,
        payment_plan_result=None,
        human_collection_result=None,
        status_update_result=None,
        compliance_report=None,
        # Routing flags
        should_offer_payment_plan=False,
        needs_human_agent=False,
        pipeline_complete=False,
        error_message=None,
        # Metadata
        pipeline_run_id=str(uuid.uuid4()),
        pipeline_logs=[],
    )
