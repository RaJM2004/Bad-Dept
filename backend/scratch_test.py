import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import jwt
from datetime import datetime, timedelta
import urllib.request
import urllib.error
import json
import time

MONGO_URI = "mongodb://quantxai25_db_user:bhUycIvcihv1Iwzq@ac-ikqsyzh-shard-00-00.qpluwed.mongodb.net:27017,ac-ikqsyzh-shard-00-01.qpluwed.mongodb.net:27017,ac-ikqsyzh-shard-00-02.qpluwed.mongodb.net:27017/bad-debt-collection?ssl=true&replicaSet=atlas-q4z81m-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0"
JWT_SECRET = "supersecretkeyfortestingourmvp"

async def test_inbox():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.get_database()
    
    user = await db["users"].find_one({"accessToken": {"$exists": True, "$ne": None}}, sort=[("updatedAt", -1)])
    if not user:
        return
        
    expires = datetime.now() + timedelta(days=7)
    token = jwt.encode(
        {"id": str(user["_id"]), "email": user["email"], "role": user["role"], "exp": expires},
        JWT_SECRET,
        algorithm="HS256"
    )
    
    req = urllib.request.Request(
        'http://localhost:8000/api/gmail/inbox?label=INBOX',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    )
    
    print("Sending request...")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req) as response:
            res = response.read().decode()
            print(f"Success in {time.time()-t0:.2f}s, length: {len(res)}")
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code)
        print(e.read().decode())
    except Exception as e:
        print("Other Error:", e)

if __name__ == "__main__":
    asyncio.run(test_inbox())
