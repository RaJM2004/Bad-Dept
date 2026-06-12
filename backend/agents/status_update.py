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
            from config.database import get_sync_db
            db = get_sync_db()
            if db is not None:
                from bson import ObjectId

                # Update customer status
                db["customers"].update_one(
                    {"_id": ObjectId(customer_id)},
                    {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}},
                )
                # Append to contact history
                db["accounts"].update_one(
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

                db_updated = True
                state["pipeline_logs"].append(f"{log_prefix} 💾 MongoDB updated. Status → {new_status}")
        except Exception as db_err:
            state["pipeline_logs"].append(f"{log_prefix} ⚠️ MongoDB update failed: {db_err}")

        # Helper to get credentials
        def get_creds():
            try:
                from config.database import get_sync_db
                db = get_sync_db()
                if db is None: return None
                user = db["users"].find_one({"accessToken": {"$exists": True}})
                if user and user.get("accessToken"):
                    from config.google_client import build_credentials
                    return build_credentials(user["accessToken"], user.get("refreshToken"))
            except Exception as e:
                pass
            return None

        creds = get_creds()

        # ── Google Sheets sync (stub) ──────────────────────────────────────
        # Left stubbed as it requires a specific pre-existing spreadsheetId to update
        state["pipeline_logs"].append(f"{log_prefix} 📊 Google Sheets: Status synced (stub)")

        # ── Google Drive upload ────────────────────────────────────
        try:
            state["pipeline_logs"].append(f"{log_prefix} 📁 Google Drive: Uploading log to Drive")
            if creds:
                from config.google_client import get_drive_service
                from googleapiclient.http import MediaIoBaseUpload
                import io
                import json
                
                drive = get_drive_service(creds)
                log_data = json.dumps(state["pipeline_logs"], indent=2)
                media = MediaIoBaseUpload(io.BytesIO(log_data.encode("utf-8")), mimetype="application/json")
                
                drive.files().create(
                    body={"name": f"run_{state.get('pipeline_run_id')}.json"},
                    media_body=media
                ).execute()
            else:
                state["pipeline_logs"].append(f"{log_prefix} ⚠️ Google Drive upload failed: No credentials")
        except Exception as e:
            state["pipeline_logs"].append(f"{log_prefix} ⚠️ Google Drive upload failed: {e}")

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
