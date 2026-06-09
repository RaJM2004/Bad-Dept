from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime
from bson import ObjectId
from config.database import get_db
from middleware.auth import get_current_user
from models.customer import CustomerCreate, CustomerUpdate
from models.account import AddPaymentRequest

router = APIRouter()


def _serialize_customer(cust: dict, account: dict = None, payment_plan=None) -> dict:
    result = {
        "id": str(cust["_id"]),
        "_id": str(cust["_id"]),
        "name": cust.get("name"),
        "email": cust.get("email"),
        "phone": cust.get("phone"),
        "status": cust.get("status", "Active"),
        "googleSheetRowId": cust.get("googleSheetRowId"),
        "createdAt": cust.get("createdAt"),
        "updatedAt": cust.get("updatedAt"),
        "outstandingAmount": 0,
        "daysOverdue": 0,
        "riskScore": 0,
        "hasActivePlan": False,
    }
    if isinstance(cust.get("assignedOfficer"), dict):
        result["assignedOfficer"] = cust["assignedOfficer"]
    elif cust.get("assignedOfficer"):
        result["assignedOfficer"] = {"_id": str(cust["assignedOfficer"])}

    if account:
        result["outstandingAmount"] = account.get("outstandingAmount", 0)
        result["daysOverdue"] = account.get("daysOverdue", 0)
        result["riskScore"] = account.get("riskScore", 0)
    if payment_plan:
        result["hasActivePlan"] = True
    return result


@router.get("")
async def get_customers(
    status: Optional[str] = None,
    search: Optional[str] = None,
    assignedToMe: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if assignedToMe == "true":
        query["assignedOfficer"] = ObjectId(current_user["id"])
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]

    customers = await db["customers"].find(query).sort("updatedAt", -1).to_list(None)
    result = []
    for cust in customers:
        account = await db["accounts"].find_one({"customerId": cust["_id"]})
        plan = await db["paymentplans"].find_one({"customerId": cust["_id"], "status": "Active"})
        result.append(_serialize_customer(cust, account, plan))
    return result


@router.get("/{id}")
async def get_customer_by_id(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID")

    cust = await db["customers"].find_one({"_id": oid})
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Populate assigned officer
    if cust.get("assignedOfficer"):
        officer = await db["users"].find_one({"_id": cust["assignedOfficer"]})
        if officer:
            cust["assignedOfficer"] = {"_id": str(officer["_id"]), "name": officer["name"], "email": officer["email"], "role": officer["role"]}

    account = await db["accounts"].find_one({"customerId": oid})
    payment_plan = await db["paymentplans"].find_one({"customerId": oid})
    comms = await db["communications"].find({"customerId": oid}).sort("createdAt", -1).to_list(50)

    def serialize_doc(doc):
        if doc:
            doc["id"] = str(doc.pop("_id"))
            for k, v in doc.items():
                if isinstance(v, ObjectId):
                    doc[k] = str(v)
        return doc

    return {
        "customer": serialize_doc(cust),
        "account": serialize_doc(account) or {"outstandingAmount": 0, "daysOverdue": 0, "paymentHistory": [], "contactHistory": [], "riskScore": 0},
        "paymentPlan": serialize_doc(payment_plan),
        "communications": [serialize_doc(c) for c in comms],
    }


@router.post("")
async def create_customer(body: CustomerCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db["customers"].find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Customer with this email already exists")

    now = datetime.utcnow()
    cust_doc = {
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "status": "Active",
        "assignedOfficer": ObjectId(body.assigned_officer) if body.assigned_officer else ObjectId(current_user["id"]),
        "createdAt": now,
        "updatedAt": now,
    }
    cust_result = await db["customers"].insert_one(cust_doc)
    customer_oid = cust_result.inserted_id

    risk_score = min(int(body.days_overdue * 1.5), 100) if body.days_overdue else 0
    acct_doc = {
        "customerId": customer_oid,
        "outstandingAmount": body.outstanding_amount,
        "daysOverdue": body.days_overdue,
        "riskScore": risk_score,
        "paymentHistory": [],
        "contactHistory": [],
        "createdAt": now,
        "updatedAt": now,
    }
    await db["accounts"].insert_one(acct_doc)

    cust = await db["customers"].find_one({"_id": customer_oid})
    account = await db["accounts"].find_one({"customerId": customer_oid})
    return {"customer": _serialize_customer(cust, account), "account": account}


@router.patch("/{id}/status")
async def update_customer_status(id: str, body: CustomerUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID")

    update = {"updatedAt": datetime.utcnow()}
    if body.status:
        update["status"] = body.status
    if body.assigned_officer:
        update["assignedOfficer"] = ObjectId(body.assigned_officer)

    result = await db["customers"].update_one({"_id": oid}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")

    cust = await db["customers"].find_one({"_id": oid})
    return _serialize_customer(cust)


@router.post("/{id}/payment")
async def add_payment_transaction(id: str, body: AddPaymentRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID")

    account = await db["accounts"].find_one({"customerId": oid})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    payment_entry = {
        "date": datetime.fromisoformat(body.date) if body.date else datetime.utcnow(),
        "amount": body.amount,
        "status": body.status,
    }

    update = {
        "$push": {"paymentHistory": payment_entry},
        "$set": {"updatedAt": datetime.utcnow()},
    }

    if body.status == "Success":
        new_outstanding = max(0, account.get("outstandingAmount", 0) - body.amount)
        new_risk = max(0, account.get("riskScore", 0) - 15)
        update["$set"]["outstandingAmount"] = new_outstanding
        update["$set"]["riskScore"] = new_risk
        update["$set"]["lastPaidDate"] = datetime.utcnow()

        if new_outstanding == 0:
            await db["customers"].update_one({"_id": oid}, {"$set": {"status": "Settled", "updatedAt": datetime.utcnow()}})

    await db["accounts"].update_one({"customerId": oid}, update)
    updated_account = await db["accounts"].find_one({"customerId": oid})
    updated_account["id"] = str(updated_account.pop("_id"))
    return updated_account
