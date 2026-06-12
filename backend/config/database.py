import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/bad-debt-collection")

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.get_default_database()
    print(f"✅ Connected to MongoDB Atlas")
    return db


async def close_db():
    global client
    if client:
        client.close()
        print("MongoDB connection closed.")


def get_db():
    return db


def get_sync_db():
    from pymongo import MongoClient
    import certifi
    global _sync_client
    if "_sync_client" not in globals():
        global _sync_client
        _sync_client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    return _sync_client.get_default_database()
