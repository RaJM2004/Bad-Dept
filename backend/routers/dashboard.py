from fastapi import APIRouter, Depends
from config.database import get_db
from middleware.auth import get_current_user

router = APIRouter()


async def _build_stats(db):
    total_customers = await db["customers"].count_documents({})
    active = await db["customers"].count_documents({"status": "Active"})
    settled = await db["customers"].count_documents({"status": "Settled"})
    escalated = await db["customers"].count_documents({"status": "Escalated"})
    disputed = await db["customers"].count_documents({"status": "Disputed"})

    # Total outstanding
    outstanding_result = []
    async for doc in db["accounts"].aggregate([{"$group": {"_id": None, "total": {"$sum": "$outstandingAmount"}}}]):
        outstanding_result.append(doc)
    total_outstanding = outstanding_result[0]["total"] if outstanding_result else 0

    # Amount recovered (sum of all successful payments)
    recovered_result = []
    async for doc in db["accounts"].aggregate([
        {"$unwind": "$paymentHistory"},
        {"$match": {"paymentHistory.status": "Success"}},
        {"$group": {"_id": None, "total": {"$sum": "$paymentHistory.amount"}}},
    ]):
        recovered_result.append(doc)
    amount_recovered = recovered_result[0]["total"] if recovered_result else 0

    high_risk = await db["accounts"].count_documents({"riskScore": {"$gte": 75}})
    active_plans = await db["paymentplans"].count_documents({"status": "Active"})

    success_rate = round((settled / total_customers * 100), 1) if total_customers > 0 else 0

    # Recent agent logs
    recent_logs = []
    async for log in db["agentlogs"].find().sort("createdAt", -1).limit(10):
        log["id"] = str(log.pop("_id"))
        recent_logs.append(log)

    # Agent performance metrics
    agent_metrics = []
    async for m in db["agentlogs"].aggregate([
        {"$group": {
            "_id": "$agentName",
            "totalCalls": {"$sum": 1},
            "successCount": {"$sum": {"$cond": [{"$eq": ["$status", "Success"]}, 1, 0]}},
            "avgDuration": {"$avg": "$durationMs"},
        }}
    ]):
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
        # KPI shape the frontend expects
        "kpis": {
            "totalCustomers": total_customers,
            "activeCases": active,
            "settledCases": settled,
            "successRate": success_rate,
            "outstandingAmount": total_outstanding,
            "amountRecovered": amount_recovered,
            "highRiskAccounts": high_risk,
            "activePaymentPlans": active_plans,
        },
    }


@router.get("")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    db = get_db()
    return await _build_stats(db)


# Alias: /dashboard/metrics — called by Dashboard.tsx and Reports.tsx
@router.get("/metrics")
async def get_dashboard_metrics(current_user: dict = Depends(get_current_user)):
    db = get_db()
    return await _build_stats(db)
