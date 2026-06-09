from fastapi import APIRouter, Depends
from config.database import get_db
from middleware.auth import get_current_user
from bson import ObjectId

router = APIRouter()


@router.get("")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    db = get_db()

    total_customers = await db["customers"].count_documents({})
    active = await db["customers"].count_documents({"status": "Active"})
    settled = await db["customers"].count_documents({"status": "Settled"})
    escalated = await db["customers"].count_documents({"status": "Escalated"})
    disputed = await db["customers"].count_documents({"status": "Disputed"})

    # Total outstanding amount
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$outstandingAmount"}}}]
    outstanding_result = []
    async for doc in db["accounts"].aggregate(pipeline):
        outstanding_result.append(doc)
    total_outstanding = outstanding_result[0]["total"] if outstanding_result else 0

    # High-risk accounts (risk score >= 75)
    high_risk = await db["accounts"].count_documents({"riskScore": {"$gte": 75}})

    # Active payment plans
    active_plans = await db["paymentplans"].count_documents({"status": "Active"})

    # Recent agent logs
    recent_logs = []
    async for log in db["agentlogs"].find().sort("createdAt", -1).limit(10):
        log["id"] = str(log.pop("_id"))
        recent_logs.append(log)

    # Agent performance metrics
    metrics_pipeline = [
        {"$group": {
            "_id": "$agentName",
            "totalCalls": {"$sum": 1},
            "successCount": {"$sum": {"$cond": [{"$eq": ["$status", "Success"]}, 1, 0]}},
            "avgDuration": {"$avg": "$durationMs"},
        }}
    ]
    agent_metrics = []
    async for m in db["agentlogs"].aggregate(metrics_pipeline):
        agent_metrics.append(m)

    return {
        "customers": {
            "total": total_customers,
            "active": active,
            "settled": settled,
            "escalated": escalated,
            "disputed": disputed,
        },
        "totalOutstanding": total_outstanding,
        "highRiskAccounts": high_risk,
        "activePaymentPlans": active_plans,
        "recentAgentLogs": recent_logs,
        "agentMetrics": agent_metrics,
    }
