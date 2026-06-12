from config.database import get_sync_db
import traceback

db = get_sync_db()
if db is not None:
    logs = db.agentlogs.find().sort("createdAt", -1).limit(5)
    for log in logs:
        print("Log:", log.get("agentName"), log.get("status"), log.get("errorMessage"))
        if log.get("agentName") == "Pipeline Run":
            print(log)
