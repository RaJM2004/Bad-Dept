# AI-Powered Multi-Agent Bad Debt Collection Platform

A production-ready, AI-driven debt collection system that automates customer communication, intent & sentiment analysis, and payment reconciliation.

This platform utilizes a multi-agent stateful pipeline built with **LangGraph** and **FastAPI** on the backend, alongside a modern, responsive **React** frontend. It leverages **Groq** for high-speed LLM inference and integrates seamlessly with third-party providers like Google Workspace and Razorpay.

## Features

- **Multi-Agent Pipeline**: Automates account screening, contact strategy generation, outreach, and payment plan generation via LangGraph.
- **Intent & Sentiment Analysis**: Employs Llama 3.3 70B (via Groq) to accurately discern customer sentiment and intent.
- **Automated Communication**: Facilitates personalized outreach and automated responses.
- **Payment Reconciliation**: Deep integration with Razorpay for payment link generation and processing.
- **Visual Audit Trail**: Provides an n8n-style transparent view of AI agent decisions to track end-to-end execution.
- **Escalation Queue**: Designed for human intervention on high-risk or complex accounts requiring manual review.
- **Google Workspace Integration**: Connects with Gmail, Calendar, Sheets, Drive for synchronized tracking and documentation.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide React
- **Backend**: FastAPI (Python), Motor (Async MongoDB Driver), LangGraph
- **AI/LLM**: Groq (llama-3.3-70b-versatile)
- **Database**: MongoDB

## Repository Structure

- `/frontend` - Contains the React Vite application.
- `/backend` - Contains the FastAPI application and LangGraph agents.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python (3.10+)
- MongoDB Atlas cluster (or local instance)
- Groq API Key
- Google OAuth Credentials
- Razorpay Credentials

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure Environment Variables:
   Create a `.env` file in the `backend` directory with your credentials:
   ```
   MONGO_URI=mongodb+srv://...
   JWT_SECRET=your_jwt_secret
   GROQ_API_KEY=gsk_...
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
5. Start the server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The API will be available at `http://localhost:8000`, and interactive docs at `http://localhost:8000/docs`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   Create a `.env` file in the `frontend` directory:
   ```
   VITE_API_URL=http://localhost:8000
   # Add other required frontend keys here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The UI will be accessible at `http://localhost:5173`.

## Default Credentials for Testing

- **Admin Account**: `admin@example.com` / `admin123`
- **Collection Officer**: `officer@example.com` / `officer123`
