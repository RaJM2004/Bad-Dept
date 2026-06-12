import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

# Allow HTTP traffic for local dev with OAuthLib
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "postmessage")

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/documents",
]

CLIENT_CONFIG = {
    "web": {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uris": [GOOGLE_REDIRECT_URI],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
}


def get_oauth2_flow() -> Flow:
    """Create an OAuth2 flow for exchanging auth codes."""
    return Flow.from_client_config(
        CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )


def build_credentials(access_token: str, refresh_token: str = None) -> Credentials:
    """Build Google credentials from stored tokens."""
    return Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )


def get_gmail_service(credentials: Credentials):
    return build("gmail", "v1", credentials=credentials)


def get_calendar_service(credentials: Credentials):
    return build("calendar", "v3", credentials=credentials)


def get_sheets_service(credentials: Credentials):
    return build("sheets", "v4", credentials=credentials)


def get_drive_service(credentials: Credentials):
    return build("drive", "v3", credentials=credentials)


def get_slides_service(credentials: Credentials):
    return build("slides", "v1", credentials=credentials)


def get_docs_service(credentials: Credentials):
    return build("docs", "v1", credentials=credentials)
