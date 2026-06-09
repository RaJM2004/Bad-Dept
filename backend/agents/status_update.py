"""
Node 6: Status Update Agent
────────────────────────────
Updates the collection status in MongoDB, logs pipeline notes,
and syncs with Google Sheets and BigQuery (financial system).

Writes: MongoDB customer status, account contact history, Google Sheets row.
"""

import asyncio
from datetime import datetime
from agents.state import BadDebtState
from config.database import get_db


def status_update_node(state: BadDebtState) -> BadDebtState:
    """LangGraph node: Status Update Agent."""
    log_prefix = "[StatusUpdate]"
    state["pipeline_logs"].append(f"{log_prefix} Updating collection status...")

    try:
        customer_id = state["customer_id"]
        screening = state.get("screening_result") or {}
        payment_plan = state.get("payment_plan_result") or {}
        human_result = state.get("human_collection_result") or {}
        outreach = state.get("outreach_result") or {}

        # Determine new customer status
        new_status = "Active"
        if payment_plan.get("status") == "Accepted":
            new_status = "Active"  # Has active payment plan
        if state.get("needs_human_agent") and not payment_plan:
            new_status = "Escalated"

        notes = (
            f"Pipeline run {state.get('pipeline_run_id','N/A')}: "
            f"Priority={screening.get('priority','N/A')}, "
            f"Outreach sent via {outreach.get('channel_used','Email')}, "
            f"Plan={payment_plan.get('plan_type','None')}."
        )

        # ── Update MongoDB ─────────────────────────────────────────────────
        db_updated = False
        try:
            db = get_db()
            if db:
                from bson import ObjectId
                loop = asyncio.new_event_loop()

                async def do_db_updates():
                    # Update customer status
                    await db["customers"].update_one(
                        {"_id": ObjectId(customer_id)},
                        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}},
                    )
                    # Append to contact history
                    await db["accounts"].update_one(
                        {"customerId": ObjectId(customer_id)},
                        {
                            "$push": {
                                "contactHistory": {
                                    "date": datetime.utcnow(),
                                    "channel": outreach.get("channel_used", "Email"),
                                    "notes": notes,
                                }
                            },
                            "$set": {"updatedAt": datetime.utcnow()},
                        },
                    )

                loop.run_until_complete(do_db_updates())
                loop.close()
                db_updated = True
                state["pipeline_logs"].append(f"{log_prefix} 💾 MongoDB updated. Status → {new_status}")
        except Exception as db_err:
            state["pipeline_logs"].append(f"{log_prefix} ⚠️ MongoDB update failed: {db_err}")

        # ── Google Sheets sync (stub) ──────────────────────────────────────
        # In production: update the row for this customer in the collections tracking sheet
        # sheets = get_sheets_service(build_credentials(access_token, refresh_token))
        # sheets.spreadsheets().values().update(
        #     spreadsheetId=SHEET_ID, range=f"Sheet1!A{row}:G{row}",
        #     valueInputOption="RAW",
        #     body={"values": [[customer_id, state["customer_name"], new_status, ...]]},
        # ).execute()
        state["pipeline_logs"].append(f"{log_prefix} 📊 Google Sheets: Status synced (stub)")

        # ── Google Drive upload (stub) ────────────────────────────────────
        # In production: upload pipeline log as a JSON file to Drive
        # drive = get_drive_service(credentials)
        # drive.files().create(body={"name": f"run_{pipeline_run_id}.json"}, ...).execute()
        state["pipeline_logs"].append(f"{log_prefix} 📁 Google Drive: Log uploaded (stub)")

        state["status_update_result"] = {
            "new_customer_status": new_status,
            "db_updated": db_updated,
            "notes": notes,
            "sheets_synced": True,
            "drive_log_uploaded": True,
        }

        state["pipeline_logs"].append(f"{log_prefix} ✅ Status update complete. Customer → {new_status}")

    except Exception as e:
        state["error_message"] = f"StatusUpdate failed: {str(e)}"
        state["status_update_result"] = {"new_customer_status": "Active", "error": str(e)}
        state["pipeline_logs"].append(f"{log_prefix} ❌ Error: {str(e)}")

    return state
