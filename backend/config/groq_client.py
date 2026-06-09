import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

groq_client: Groq = None


def get_groq_client() -> Groq:
    global groq_client
    if groq_client is None:
        if GROQ_API_KEY:
            groq_client = Groq(api_key=GROQ_API_KEY)
            print("✅ Groq client initialized")
        else:
            print("⚠️  GROQ_API_KEY not set – running in mock mode")
    return groq_client


def is_groq_enabled() -> bool:
    return bool(GROQ_API_KEY)
