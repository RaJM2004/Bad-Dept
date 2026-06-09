# Bad Debt Collection Platform – Python Backend

FastAPI + LangGraph backend for the AI-powered bad debt collection platform.

## Tech Stack
- **FastAPI** — async REST API (replaces Express)
- **Motor** — async MongoDB driver (replaces Mongoose)
- **LangGraph** — multi-agent stateful pipeline (7 nodes)
- **Groq** — LLM inference (llama-3.3-70b-versatile)
- **Google APIs** — Gmail, Calendar, Sheets, Drive, Slides, Docs

## Agent Pipeline

```
Account Screening → Contact Strategy → Outreach Automation
                                              ↓
                              ┌───────────────────────────┐
                              │ should_offer_payment_plan? │
                              │ Yes → Payment Plan Agent   │
                              │       → Human Collection   │
                              └───────────────────────────┘
                                              ↓
                              Status Update → Compliance & Reporting
```

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server (development)
uvicorn main:app --reload --port 8000

# Run in production
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Environment Variables

Copy `.env` and fill in your values:
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret
GROQ_API_KEY=gsk_...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Local login |
| POST | /api/auth/google | Google OAuth login |
| GET | /api/customers | List all customers |
| POST | /api/customers | Create customer |
| POST | **`/api/agents/run-pipeline`** | **🚀 Run full LangGraph pipeline** |
| POST | /api/agents/intent | Intent detection |
| POST | /api/agents/sentiment | Sentiment analysis |
| POST | /api/agents/resolution | Resolution recommendation |
| GET | /api/agents/logs | Agent execution logs |
| GET | /api/dashboard | Dashboard stats |

## Interactive Docs

Visit http://localhost:8000/docs for the Swagger UI.

## Default Test Credentials
- **Admin:** `admin@example.com` / `admin123`
- **Officer:** `officer@example.com` / `officer123`
