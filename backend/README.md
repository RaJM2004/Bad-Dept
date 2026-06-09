# AI Multi-Agent Bad Debt Collection Platform Backend

This backend powers the AI-driven debt collection platform using Node.js, Express, MongoDB, and Groq (Llama 3.3).

## Setup
1. Run `npm install`
2. Create a `.env` file with `PORT=5000`, `MONGO_URI`, `GROQ_API_KEY`, `JWT_SECRET`.
3. Run `npm run dev` to start. The database will seed automatically on first boot.

## The 8-Agent Swarm
This platform utilizes a powerful multi-agent architecture for end-to-end autonomous collections.

1. **Intent Detection Agent:** Analyzes customer messages to classify their goal (e.g., Payment Promise, Dispute, Refusal).
2. **Account Lookup Agent:** securely fetches and summarizes the customer's financial standing and risk score.
3. **Sentiment & Escalation Agent:** Gauges emotional tone (Angry, Negative, Positive) and triggers human escalation protocols if it detects legal threats or abuse.
4. **Resolution Generator Agent:** Calculates the optimal financial counter-offer (Full Payment, EMI Plan, Settlement).
5. **Repayment Plans Agent:** Negotiates exact monthly EMI terms based on customer-proposed amounts and hardship reasons.
6. **Dispute Management Agent:** Analyzes dispute claims, asks for evidence, or escalates severe legal disputes.
7. **Analytics and Report Agent:** Synthesizes platform metrics into a high-level executive summary using natural language.
8. **Communication Log Agent:** Orchestrates the flow and drafts empathetic, professional emails back to the customer.

## API Testing
You can run the API tests to validate the agents:
`npx ts-node tests/api.test.ts`
