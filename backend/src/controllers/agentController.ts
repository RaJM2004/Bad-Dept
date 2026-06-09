import { Request, Response } from 'express';
import { groq, isGroqEnabled } from '../config/groq';
import Customer from '../models/Customer';
import Account from '../models/Account';
import Communication from '../models/Communication';
import AgentLog from '../models/AgentLog';
import Escalation from '../models/Escalation';
import PaymentPlan from '../models/PaymentPlan';
import { AuthRequest } from '../middleware/auth';

// Helper to log agent activities
const saveAgentLog = async (
  agentName: 'Intent Detection' | 'Account Lookup' | 'Resolution Generator' | 'Sentiment & Escalation' | 'Communication Log' | 'Repayment Plans' | 'Dispute Management' | 'Analytics & Report',
  status: 'Success' | 'Error',
  requestDetails: any,
  responseDetails: any,
  durationMs: number,
  errorMessage?: string
) => {
  try {
    await AgentLog.create({
      agentName,
      status,
      requestDetails,
      responseDetails,
      durationMs,
      errorMessage,
    });
  } catch (err) {
    console.error('Error logging agent execution:', err);
  }
};

// 1. Intent Detection Agent
export const detectIntent = async (req: AuthRequest, res: Response) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Message content is required' });
  }

  const startTime = Date.now();
  try {
    let result;
    if (isGroqEnabled()) {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an Intent Detection AI Agent for a debt collection platform. Your job is to classify the intent of a customer message into one of the following categories ONLY:
- 'Payment Commitment' (User promises to pay, specifies a date, or says payment is on the way)
- 'Payment Plan Request' (User asks for installment/EMI option, discount, or says they can't pay all at once)
- 'Already Paid' (User claims they have paid, sends transaction details/screenshots, or says transaction is cleared)
- 'Dispute' (User claims the debt is incorrect, doesn't recognize the account, or complains about service/billing)
- 'Refusal To Pay' (User explicitly says they will not pay, tells agency to stop calling, or uses harsh rejection)
- 'General Inquiry' (User asks for details, verification, contact info, balance, or other information without refusing/agreeing)
- 'Unknown' (Cannot be determined or message is empty/unrelated)

Respond ONLY with a valid JSON object in the following format, and nothing else. No markdown wrapping, no explanation:
{
  "category": "One of the values above",
  "confidence": 0.95
}`,
          },
          {
            role: 'user',
            content: `Message: "${message}"`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const jsonText = chatCompletion.choices[0]?.message?.content || '{}';
      result = JSON.parse(jsonText);
    } else {
      // Mock Intent Detection if Groq is disabled
      const msg = message.toLowerCase();
      let category = 'General Inquiry';
      let confidence = 0.85;

      if (msg.includes('will pay') || msg.includes('promise to pay') || msg.includes('sending') || msg.includes('tomorrow') || msg.includes('next week') || msg.includes('clearing')) {
        category = 'Payment Commitment';
      } else if (msg.includes('installment') || msg.includes('emi') || msg.includes('parts') || msg.includes('split') || msg.includes('plan') || msg.includes('discount')) {
        category = 'Payment Plan Request';
      } else if (msg.includes('already paid') || msg.includes('transferred') || msg.includes('sent the money') || msg.includes('done') || msg.includes('receipt')) {
        category = 'Already Paid';
      } else if (msg.includes('dispute') || msg.includes('wrong') || msg.includes('incorrect') || msg.includes('not mine') || msg.includes('don\'t owe')) {
        category = 'Dispute';
      } else if (msg.includes('will not pay') || msg.includes('refuse') || msg.includes('sue') || msg.includes('never') || msg.includes('f***') || msg.includes('stop calling')) {
        category = 'Refusal To Pay';
      }

      result = { category, confidence };
    }

    const duration = Date.now() - startTime;
    await saveAgentLog('Intent Detection', 'Success', { message }, result, duration);
    return res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Intent detection error:', error);
    await saveAgentLog('Intent Detection', 'Error', { message }, null, duration, (error as Error).message);
    return res.status(500).json({ message: 'Intent detection failed', error: (error as Error).message });
  }
};

// 2. Account Lookup Agent
export const lookupAccount = async (req: AuthRequest, res: Response) => {
  const { customerId } = req.body;
  if (!customerId) {
    return res.status(400).json({ message: 'Customer ID is required' });
  }

  const startTime = Date.now();
  try {
    const customer = await Customer.findById(customerId).populate('assignedOfficer', 'name email');
    if (!customer) {
      throw new Error('Customer not found');
    }

    const account = await Account.findOne({ customerId });
    const paymentPlans = await PaymentPlan.find({ customerId });

    const result = {
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerStatus: customer.status,
      assignedOfficer: customer.assignedOfficer,
      outstandingAmount: account ? account.outstandingAmount : 0,
      daysOverdue: account ? account.daysOverdue : 0,
      riskScore: account ? account.riskScore : 0,
      lastPaidDate: account?.lastPaidDate || null,
      paymentHistory: account ? account.paymentHistory : [],
      contactHistory: account ? account.contactHistory : [],
      paymentPlans,
    };

    const duration = Date.now() - startTime;
    await saveAgentLog('Account Lookup', 'Success', { customerId }, result, duration);
    return res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Account lookup error:', error);
    await saveAgentLog('Account Lookup', 'Error', { customerId }, null, duration, (error as Error).message);
    return res.status(500).json({ message: 'Account lookup failed', error: (error as Error).message });
  }
};

// 3. Sentiment & Escalation Detection Agent
export const detectSentimentAndEscalation = async (req: AuthRequest, res: Response) => {
  const { message, customerId } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Message content is required' });
  }

  const startTime = Date.now();
  try {
    let accountDetails = null;
    if (customerId) {
      accountDetails = await Account.findOne({ customerId });
    }

    let result;
    if (isGroqEnabled()) {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a Sentiment & Escalation Detection Agent for a debt collection agency. 
Your task is to analyze the sentiment of a customer's message and determine if it should be escalated to a human agent.

Sentiment Categories:
- 'Positive' (Cooperative, friendly, willing to work things out)
- 'Neutral' (Standard request, asking for details, dry and objective)
- 'Negative' (Sad, stressed, worried, complaining, but not abusive)
- 'Angry' (Frustrated, screaming in caps, hostile, accusing, using profanity)
- 'Legal Threat' (Mentions lawyer, attorney, court, legal action, sue, police, police complaint, regulatory body like CFPB/FTC)

Escalation Conditions (Set shouldEscalate = true if ANY apply):
- Sentiment is 'Angry' or 'Legal Threat'
- Customer mentions they cannot pay because of extreme hardship or bankruptcy
- Abusive or offensive language is used

Respond ONLY with a valid JSON object in the following format:
{
  "sentiment": "One of: Positive, Neutral, Negative, Angry, Legal Threat",
  "confidence": 0.95,
  "shouldEscalate": true,
  "escalationReason": "Detailed reason why (e.g. Legal threat detected or High anger level)"
}`,
          },
          {
            role: 'user',
            content: `Customer Message: "${message}"`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const jsonText = chatCompletion.choices[0]?.message?.content || '{}';
      result = JSON.parse(jsonText);
    } else {
      // Mock Sentiment and Escalation Detection
      const msg = message.toLowerCase();
      let sentiment = 'Neutral';
      let confidence = 0.8;
      let shouldEscalate = false;
      let escalationReason = null;

      if (msg.includes('sue') || msg.includes('lawyer') || msg.includes('attorney') || msg.includes('legal') || msg.includes('court') || msg.includes('police')) {
        sentiment = 'Legal Threat';
        shouldEscalate = true;
        escalationReason = 'Legal action threat detected in customer message.';
      } else if (msg.includes('fuck') || msg.includes('shit') || msg.includes('harass') || msg.includes('hell') || msg.includes('bastard') || msg.includes('stop calling')) {
        sentiment = 'Angry';
        shouldEscalate = true;
        escalationReason = 'Hostile or abusive language detected.';
      } else if (msg.includes('sorry') || msg.includes('wish I could') || msg.includes('hardship') || msg.includes('lost my job') || msg.includes('unemployed') || msg.includes('medical')) {
        sentiment = 'Negative';
        shouldEscalate = false; // Negative but cooperative
      } else if (msg.includes('thank you') || msg.includes('appreciate') || msg.includes('great') || msg.includes('happy to')) {
        sentiment = 'Positive';
      }

      // Add high value account escalation check
      if (accountDetails && accountDetails.outstandingAmount > 10000) {
        shouldEscalate = true;
        escalationReason = escalationReason 
          ? `${escalationReason} Plus, high-value account balance: $${accountDetails.outstandingAmount}`
          : `High-value account balance ($${accountDetails.outstandingAmount}) exceeds escalation threshold.`;
      }

      result = { sentiment, confidence, shouldEscalate, escalationReason };
    }

    const duration = Date.now() - startTime;
    await saveAgentLog('Sentiment & Escalation', 'Success', { message, customerId }, result, duration);
    return res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Sentiment detection error:', error);
    await saveAgentLog('Sentiment & Escalation', 'Error', { message, customerId }, null, duration, (error as Error).message);
    return res.status(500).json({ message: 'Sentiment analysis failed', error: (error as Error).message });
  }
};

// 4. Resolution Generator Agent
export const generateResolution = async (req: AuthRequest, res: Response) => {
  const { customerId, customerIntent, customerSentiment } = req.body;
  if (!customerId) {
    return res.status(400).json({ message: 'Customer ID is required' });
  }

  const startTime = Date.now();
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const account = await Account.findOne({ customerId });
    if (!account) {
      throw new Error('Account not found');
    }

    let result;
    if (isGroqEnabled()) {
      const accountInfo = {
        name: customer.name,
        outstandingAmount: account.outstandingAmount,
        daysOverdue: account.daysOverdue,
        riskScore: account.riskScore,
        paymentHistoryLength: account.paymentHistory.length,
      };

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a Resolution Generator AI Agent for a debt collection agency. 
Your task is to review the customer's account context, detected intent, and sentiment, then recommend a customized payment recovery resolution.

Resolution Actions:
- 'Full Payment': Appropriate when customer is cooperative, has low overdue days (<30), or indicates payment capability.
- 'EMI Plan': Appropriate when customer requests installment plan, shows financial distress but is cooperative, or has medium overdue days (30-90).
- 'Settlement Offer': Appropriate when customer is highly delinquent (>90 days), shows medium-to-high risk, but is willing to pay a lump sum at a discount (usually 20-50% off).
- 'Human Escalation': Appropriate for abusive, angry customers, legal threats, or high risk accounts.

Risk Score: Recalculate and output a risk score from 0 (very low risk of write-off) to 100 (extreme risk of write-off).

Payment Schedule: Define a specific recommended schedule. E.g.
  For EMI: "3 monthly payments of $X starting next week"
  For Settlement: "One-time payment of $Y (30% discount) due by Date"
  For Full Payment: "Immediate payment of full outstanding balance"
  For Human Escalation: "Escalate to Senior Officer for direct negotiation"

Respond ONLY with a valid JSON object in the following format:
{
  "recommendedAction": "One of: Full Payment, EMI Plan, Settlement Offer, Human Escalation",
  "reasoning": "A paragraph explaining why this action is recommended",
  "riskScore": 75,
  "paymentSchedule": "Description of the payment terms",
  "suggestedDiscountPercentage": 0
}`,
          },
          {
            role: 'user',
            content: `Account Info: ${JSON.stringify(accountInfo)}
Intent: ${customerIntent || 'Unknown'}
Sentiment: ${customerSentiment || 'Neutral'}`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const jsonText = chatCompletion.choices[0]?.message?.content || '{}';
      result = JSON.parse(jsonText);
    } else {
      // Mock Resolution Generator
      let recommendedAction = 'Full Payment';
      let reasoning = 'The account is in good standing and the customer is cooperative.';
      let riskScore = account.riskScore;
      let paymentSchedule = `Immediate payment of full outstanding balance $${account.outstandingAmount}`;
      let suggestedDiscountPercentage = 0;

      if (customerSentiment === 'Legal Threat' || customerSentiment === 'Angry' || customer.status === 'Escalated') {
        recommendedAction = 'Human Escalation';
        reasoning = 'Due to angry customer tone or legal threats, direct human negotiation is required.';
        paymentSchedule = 'Escalate to Senior Officer for direct negotiation';
      } else if (customerIntent === 'Payment Plan Request' || (account.daysOverdue >= 30 && account.daysOverdue < 90)) {
        recommendedAction = 'EMI Plan';
        const emiCount = account.daysOverdue > 60 ? 4 : 3;
        const emiAmt = Math.round((account.outstandingAmount / emiCount) * 100) / 100;
        reasoning = `Based on customer inquiry and ${account.daysOverdue} days overdue, an EMI plan of ${emiCount} installments is suggested to ease recovery.`;
        paymentSchedule = `${emiCount} monthly payments of $${emiAmt} starting next week`;
      } else if (customerIntent === 'Dispute') {
        recommendedAction = 'Human Escalation';
        reasoning = 'Customer disputes the balance. Requires human officer to verify invoices/billing history.';
        paymentSchedule = 'Human officer review and billing audit';
      } else if (account.daysOverdue >= 90) {
        recommendedAction = 'Settlement Offer';
        suggestedDiscountPercentage = 30;
        const settlementAmt = Math.round(account.outstandingAmount * 0.7);
        reasoning = `Account is severely delinquent (${account.daysOverdue} days). Recommending a 30% settlement offer of $${settlementAmt} to recover maximum amount quickly.`;
        paymentSchedule = `One-time settlement payment of $${settlementAmt} (30% discount) due within 10 days`;
      }

      result = {
        recommendedAction,
        reasoning,
        riskScore,
        paymentSchedule,
        suggestedDiscountPercentage,
      };
    }

    const duration = Date.now() - startTime;
    await saveAgentLog('Resolution Generator', 'Success', { customerId, customerIntent, customerSentiment }, result, duration);
    return res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Resolution generator error:', error);
    await saveAgentLog('Resolution Generator', 'Error', { customerId }, null, duration, (error as Error).message);
    return res.status(500).json({ message: 'Resolution generation failed', error: (error as Error).message });
  }
};

// 5. Communication Log Agent (Processes incoming communications and coordinates other agents)
export const logAndProcessCommunication = async (req: AuthRequest, res: Response) => {
  const { customerId, sender, messageType, content } = req.body;

  if (!customerId || !sender || !messageType || !content) {
    return res.status(400).json({ message: 'Missing required fields: customerId, sender, messageType, content' });
  }

  const startTime = Date.now();
  try {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const account = await Account.findOne({ customerId });
    if (!account) {
      return res.status(404).json({ message: 'Customer account details not found' });
    }

    // Step A: Detect Intent (Intent Agent)
    let intentCategory = 'Unknown';
    let intentConfidence = 0.5;
    try {
      let intentRes;
      if (isGroqEnabled()) {
        const comp = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'Classify intent of customer message: Payment Commitment, Payment Plan Request, Already Paid, Dispute, Refusal To Pay, General Inquiry, Unknown. Respond in JSON: {"category": "...", "confidence": 0.0}',
            },
            { role: 'user', content: content },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        intentRes = JSON.parse(comp.choices[0]?.message?.content || '{}');
      } else {
        const msg = content.toLowerCase();
        let cat = 'General Inquiry';
        if (msg.includes('will pay') || msg.includes('tomorrow') || msg.includes('next week') || msg.includes('sending')) cat = 'Payment Commitment';
        else if (msg.includes('installment') || msg.includes('emi') || msg.includes('plan')) cat = 'Payment Plan Request';
        else if (msg.includes('already paid') || msg.includes('transferred')) cat = 'Already Paid';
        else if (msg.includes('dispute') || msg.includes('wrong') || msg.includes('incorrect')) cat = 'Dispute';
        else if (msg.includes('will not pay') || msg.includes('refuse') || msg.includes('stop calling')) cat = 'Refusal To Pay';
        intentRes = { category: cat, confidence: 0.9 };
      }
      intentCategory = intentRes.category;
      intentConfidence = intentRes.confidence;
    } catch (e) {
      console.error('Error running inline intent agent:', e);
    }

    // Step B: Detect Sentiment & Escalation (Sentiment Agent)
    let sentimentCategory = 'Neutral';
    let sentimentConfidence = 0.5;
    let shouldEscalate = false;
    let escalationReason = '';
    try {
      let sentRes;
      if (isGroqEnabled()) {
        const comp = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'Classify sentiment: Positive, Neutral, Negative, Angry, Legal Threat. Detect if should escalate (e.g. angry, legal threat, abuse, hardship). Respond in JSON: {"sentiment": "...", "confidence": 0.0, "shouldEscalate": false, "escalationReason": "..."}',
            },
            { role: 'user', content: content },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        sentRes = JSON.parse(comp.choices[0]?.message?.content || '{}');
      } else {
        const msg = content.toLowerCase();
        let sent = 'Neutral';
        let esc = false;
        let reason = '';
        if (msg.includes('sue') || msg.includes('lawyer') || msg.includes('legal')) {
          sent = 'Legal Threat';
          esc = true;
          reason = 'Legal Threat detected';
        } else if (msg.includes('fuck') || msg.includes('harass') || msg.includes('stop calling')) {
          sent = 'Angry';
          esc = true;
          reason = 'Abuse/Angry tone detected';
        } else if (msg.includes('lost my job') || msg.includes('hardship')) {
          sent = 'Negative';
        } else if (msg.includes('thank you') || msg.includes('appreciate')) {
          sent = 'Positive';
        }

        if (account.outstandingAmount > 10000) {
          esc = true;
          reason = reason ? `${reason} + High Value Account` : 'High Value Account';
        }

        sentRes = { sentiment: sent, confidence: 0.9, shouldEscalate: esc, escalationReason: reason };
      }
      sentimentCategory = sentRes.sentiment;
      sentimentConfidence = sentRes.confidence;
      shouldEscalate = sentRes.shouldEscalate;
      escalationReason = sentRes.escalationReason;
    } catch (e) {
      console.error('Error running inline sentiment agent:', e);
    }

    // Step C: Generate Resolution Recommend (Resolution Agent)
    let recommendedAction = 'Full Payment';
    let resolutionReasoning = '';
    let riskScore = account.riskScore;
    let paymentSchedule = '';
    try {
      let resRes;
      if (isGroqEnabled()) {
        const comp = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'Recommend resolution action: Full Payment, EMI Plan, Settlement Offer, Human Escalation. Output riskScore (0-100) and paymentSchedule. Respond in JSON: {"recommendedAction": "...", "reasoning": "...", "riskScore": 50, "paymentSchedule": "..."}',
            },
            {
              role: 'user',
              content: `Account Balance: $${account.outstandingAmount}, Overdue: ${account.daysOverdue} days, Intent: ${intentCategory}, Sentiment: ${sentimentCategory}`,
            },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });
        resRes = JSON.parse(comp.choices[0]?.message?.content || '{}');
      } else {
        let act = 'Full Payment';
        let sch = `Full payment of $${account.outstandingAmount} due`;
        let reason = 'Normal account behavior.';
        
        if (shouldEscalate || sentimentCategory === 'Legal Threat' || sentimentCategory === 'Angry') {
          act = 'Human Escalation';
          sch = 'Escalate to human agent';
          reason = 'Escalated due to customer sentiment or risk.';
        } else if (intentCategory === 'Payment Plan Request' || account.daysOverdue >= 30) {
          act = 'EMI Plan';
          const monthly = Math.round((account.outstandingAmount / 3) * 100) / 100;
          sch = `3 monthly installments of $${monthly}`;
          reason = 'EMI plan suggested due to overdue history.';
        } else if (account.daysOverdue >= 90) {
          act = 'Settlement Offer';
          const disc = Math.round(account.outstandingAmount * 0.7);
          sch = `Lump-sum settlement of $${disc} (30% discount)`;
          reason = 'Long overdue account. Recommending settlement.';
        }

        resRes = { recommendedAction: act, reasoning: reason, riskScore: account.riskScore, paymentSchedule: sch };
      }
      recommendedAction = resRes.recommendedAction;
      resolutionReasoning = resRes.reasoning;
      riskScore = resRes.riskScore;
      paymentSchedule = resRes.paymentSchedule;
    } catch (e) {
      console.error('Error running inline resolution agent:', e);
    }

    // Step D: AI Response Generation
    // Generate an automatic professional message response based on the intent & resolution
    let generatedResponseText = '';
    try {
      if (isGroqEnabled()) {
        const responseComp = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: 'You are an automated professional collection assistant. Draft a short, empathetic, professional response to the customer. No markdown wrapping. Be very concise (max 3 sentences). Refer to the proposed solution.',
            },
            {
              role: 'user',
              content: `Customer Name: ${customer.name}. Outstanding: $${account.outstandingAmount}. Message: "${content}". Proposed Action: ${recommendedAction}. Schedule: ${paymentSchedule}. Reasoning: ${resolutionReasoning}`,
            },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
        });
        generatedResponseText = responseComp.choices[0]?.message?.content || '';
      } else {
        if (recommendedAction === 'EMI Plan') {
          generatedResponseText = `Dear ${customer.name}, we understand your situation. We can offer you an installment plan: ${paymentSchedule}. Please let us know if this works for you.`;
        } else if (recommendedAction === 'Settlement Offer') {
          generatedResponseText = `Dear ${customer.name}, to help resolve your account, we are pleased to offer a settlement: ${paymentSchedule}. Let us know if you would like to proceed.`;
        } else if (recommendedAction === 'Human Escalation') {
          generatedResponseText = `Dear ${customer.name}, we have noted your comments. A senior manager has been assigned to review your account details and will contact you shortly to assist with a resolution.`;
        } else {
          generatedResponseText = `Dear ${customer.name}, thank you for your message. We request you to clear the outstanding balance of $${account.outstandingAmount} using the link in your email. Let us know if you need assistance.`;
        }
      }
    } catch (e) {
      console.error('Error generating AI response:', e);
    }

    // Save the incoming communication
    const comm = await Communication.create({
      customerId,
      sender,
      messageType,
      content,
      intent: { category: intentCategory as any, confidence: intentConfidence },
      sentiment: { category: sentimentCategory as any, confidence: sentimentConfidence },
      responseGenerated: generatedResponseText,
      responseSent: false,
    });

    // Update Account details
    account.riskScore = riskScore;
    account.contactHistory.push({
      date: new Date(),
      channel: messageType === 'Email' ? 'Email' : 'SMS',
      notes: `Received message: "${content.substring(0, 40)}...". Intent: ${intentCategory}, Sentiment: ${sentimentCategory}`,
    });
    await account.save();

    // If escalation triggered, create Escalation record and update Customer status
    if (shouldEscalate || recommendedAction === 'Human Escalation') {
      customer.status = 'Escalated';
      await customer.save();

      // Check if open escalation already exists
      const existingEsc = await Escalation.findOne({ customerId, status: { $ne: 'Resolved' } });
      if (!existingEsc) {
        await Escalation.create({
          customerId,
          reason: escalationReason || 'Escalation requested by AI agents.',
          severity: sentimentCategory === 'Legal Threat' ? 'Critical' : 'High',
          status: 'Pending',
          assignedTo: customer.assignedOfficer,
        });
      }
    }

    const duration = Date.now() - startTime;
    const agentDetails = {
      intent: { category: intentCategory, confidence: intentConfidence },
      sentiment: { category: sentimentCategory, confidence: sentimentConfidence, shouldEscalate, escalationReason },
      resolution: { recommendedAction, reasoning: resolutionReasoning, riskScore, paymentSchedule },
      response: generatedResponseText,
    };

    await saveAgentLog('Communication Log', 'Success', { customerId, messageType, content }, agentDetails, duration);

    return res.status(201).json({
      communication: comm,
      analysis: agentDetails,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Communication log and process error:', error);
    await saveAgentLog('Communication Log', 'Error', { customerId, content }, null, duration, (error as Error).message);
    return res.status(500).json({ message: 'Communication processing failed', error: (error as Error).message });
  }
};

// 6. Generate Persuasive Collection Email
export const generateEmail = async (req: AuthRequest, res: Response) => {
  const { customerId, recommendedAction, paymentSchedule, riskScore } = req.body;
  if (!customerId || !recommendedAction || !paymentSchedule) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const customer = await Customer.findById(customerId);
    const account = await Account.findOne({ customerId });
    
    if (!customer || !account) {
      return res.status(404).json({ message: 'Customer or account not found' });
    }

    let emailBody = '';
    
    if (isGroqEnabled()) {
      const prompt = `You are a highly professional, firm, yet empathetic debt collection agent. 
Draft a persuasive, HTML-formatted email to collect an outstanding debt. 
Customer Name: ${customer.name}
Outstanding Amount: $${account.outstandingAmount}
Days Overdue: ${account.daysOverdue} days
Proposed Resolution: ${recommendedAction}
Schedule: ${paymentSchedule}

Important Guidelines:
- The email must look like a formal notice but maintain a respectful tone.
- Emphasize the urgency of the situation (especially if days overdue is high).
- Make sure to clearly state the proposed resolution and the schedule.
- Include a clear call to action to "Pay Securely Online".
- You MUST output ONLY valid HTML code. No markdown formatting, no \`\`\`html tags. Just the raw HTML content starting with <div>. Use inline CSS for beautiful, modern styling (e.g., sans-serif fonts, subtle borders, a blue payment button).`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'system', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
      });

      emailBody = chatCompletion.choices[0]?.message?.content || '';
      // Clean up if it returned markdown anyway
      emailBody = emailBody.replace(/```html/g, '').replace(/```/g, '').trim();
    } else {
      // Mock email if Groq is disabled
      emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #f1f5f9; padding: 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
            <h2 style="margin: 0; color: #0f172a;">Action Required: Outstanding Balance</h2>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #334155;">Dear <strong>${customer.name}</strong>,</p>
            <p style="font-size: 16px; color: #334155;">We are writing to you regarding your outstanding balance of <strong>$${account.outstandingAmount.toLocaleString()}</strong>, which is currently <strong>${account.daysOverdue} days overdue</strong>.</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0;">
              <h3 style="margin-top: 0; color: #0f172a;">Proposed Resolution: ${recommendedAction}</h3>
              <p style="margin-bottom: 0; color: #334155;">${paymentSchedule}</p>
            </div>
            <p style="font-size: 16px; color: #334155;">Please complete your payment securely using the link below:</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="#" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Complete Payment</a>
            </div>
          </div>
        </div>
      `;
    }

    return res.status(200).json({ emailBody });
  } catch (error) {
    console.error('Generate email error:', error);
    return res.status(500).json({ message: 'Failed to generate email', error: (error as Error).message });
  }
};

// 7. Repayment Plans Agent
export const negotiateRepaymentPlan = async (req: AuthRequest, res: Response) => {
  const { customerId, proposedAmount, hardshipReason } = req.body;
  if (!customerId || !proposedAmount) {
    return res.status(400).json({ message: 'Customer ID and proposed amount are required' });
  }

  const startTime = Date.now();
  try {
    const account = await Account.findOne({ customerId });
    if (!account) throw new Error('Account not found');

    let result;
    if (isGroqEnabled()) {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a Repayment Plans Agent. Evaluate if a customer's proposed monthly payment is acceptable based on their total outstanding amount.
If the proposed amount can pay off the debt in 6 months or less, it's 'Accepted'. Otherwise, 'Counter Offer' with an amount that pays it off in 4 months.
Respond ONLY in JSON format:
{
  "status": "Accepted" | "Counter Offer" | "Rejected",
  "approvedMonthlyAmount": number,
  "durationMonths": number,
  "reasoning": "string"
}`,
          },
          {
            role: 'user',
            content: `Outstanding: $${account.outstandingAmount}. Proposed Monthly: $${proposedAmount}. Hardship: ${hardshipReason || 'None'}`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
      result = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');
    } else {
      // Mock Repayment
      const minAcceptable = account.outstandingAmount / 6;
      if (proposedAmount >= minAcceptable) {
        result = { status: 'Accepted', approvedMonthlyAmount: proposedAmount, durationMonths: Math.ceil(account.outstandingAmount / proposedAmount), reasoning: 'Proposed amount is sufficient to clear debt within 6 months.' };
      } else {
        const counter = Math.ceil(account.outstandingAmount / 4);
        result = { status: 'Counter Offer', approvedMonthlyAmount: counter, durationMonths: 4, reasoning: 'Proposed amount is too low. Proposing a 4-month plan.' };
      }
    }

    // NEW LOGIC: Save to database if Accepted
    if (result.status === 'Accepted') {
      const schedule = [];
      let currentDate = new Date();
      for (let i = 0; i < result.durationMonths; i++) {
        // Increment month for each installment
        currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
        schedule.push({
          dueDate: currentDate,
          amount: result.approvedMonthlyAmount,
          status: 'Unpaid'
        });
      }

      await PaymentPlan.create({
        customerId: account.customerId,
        totalAmount: account.outstandingAmount,
        emiAmount: result.approvedMonthlyAmount,
        frequency: 'Monthly',
        installmentsCount: result.durationMonths,
        startDate: new Date(),
        status: 'Active',
        schedule
      });

      // Update customer status to Active (clearing escalated/disputed statuses)
      await Customer.findByIdAndUpdate(account.customerId, { status: 'Active' });
    }

    const duration = Date.now() - startTime;
    await saveAgentLog('Repayment Plans', 'Success', { customerId, proposedAmount, hardshipReason }, result, duration);
    return res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    await saveAgentLog('Repayment Plans', 'Error', { customerId }, null, duration, (error as Error).message);
    return res.status(500).json({ message: 'Repayment negotiation failed', error: (error as Error).message });
  }
};

// 8. Dispute Management Agent
export const handleDispute = async (req: AuthRequest, res: Response) => {
  const { customerId, disputeReason } = req.body;
  if (!customerId || !disputeReason) return res.status(400).json({ message: 'Missing fields' });

  const startTime = Date.now();
  try {
    const account = await Account.findOne({ customerId });
    if (!account) throw new Error('Account not found');

    let result;
    if (isGroqEnabled()) {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a Dispute Management Agent. Review the dispute claim. 
If it sounds like a simple misunderstanding, propose 'Provide Evidence'. If it sounds serious or legal, propose 'Escalate to Officer'.
Respond in JSON:
{ "action": "Provide Evidence" | "Escalate to Officer" | "Dismiss", "responseToCustomer": "string" }`,
          },
          {
            role: 'user',
            content: `Dispute Reason: "${disputeReason}". Outstanding: $${account.outstandingAmount}`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
      result = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');
    } else {
      // Mock Dispute
      if (disputeReason.toLowerCase().includes('legal') || disputeReason.toLowerCase().includes('sue')) {
        result = { action: 'Escalate to Officer', responseToCustomer: 'We take this seriously and have escalated this to a senior officer.' };
      } else {
        result = { action: 'Provide Evidence', responseToCustomer: 'Please provide receipts or bank statements to support your claim.' };
      }
    }

    if (result.action === 'Escalate to Officer') {
       await Escalation.create({
         customerId,
         reason: `Dispute: ${disputeReason}`,
         severity: 'High',
         status: 'Pending'
       });
       await Customer.findByIdAndUpdate(customerId, { status: 'Escalated' });
    } else {
       await Customer.findByIdAndUpdate(customerId, { status: 'Disputed' });
    }

    const duration = Date.now() - startTime;
    await saveAgentLog('Dispute Management', 'Success', { customerId, disputeReason }, result, duration);
    return res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    await saveAgentLog('Dispute Management', 'Error', { customerId }, null, duration, (error as Error).message);
    return res.status(500).json({ message: 'Dispute handling failed', error: (error as Error).message });
  }
};

// 9. Analytics and Report Agent
export const generateAIAnalytics = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  try {
    const { metrics } = req.body; // Pass in dashboard metrics
    let result;
    
    if (isGroqEnabled() && metrics) {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are an Analytics and Report Agent for a debt collection agency. Provide a 2-3 sentence executive summary of the performance metrics provided. Be professional and highlight key trends. Respond ONLY in JSON: { "executiveSummary": "string" }`,
          },
          {
            role: 'user',
            content: `Metrics: ${JSON.stringify(metrics)}`,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
      result = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');
    } else {
      result = { executiveSummary: 'System performance remains stable. Automated agents are actively processing the queue, leading to consistent recovery rates.' };
    }

    const duration = Date.now() - startTime;
    await saveAgentLog('Analytics & Report', 'Success', { metrics }, result, duration);
    return res.status(200).json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    await saveAgentLog('Analytics & Report', 'Error', {}, null, duration, (error as Error).message);
    return res.status(500).json({ message: 'Analytics generation failed', error: (error as Error).message });
  }
};

// Get Agent Logs for dashboard
export const getAgentLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await AgentLog.find().sort({ createdAt: -1 }).limit(100);
    
    // Group metrics by agent
    const metrics = await AgentLog.aggregate([
      {
        $group: {
          _id: '$agentName',
          totalCalls: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ['$status', 'Success'] }, 1, 0] } },
          avgDuration: { $avg: '$durationMs' },
        },
      },
    ]);

    return res.status(200).json({ logs, metrics });
  } catch (error) {
    console.error('Get agent logs error:', error);
    return res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
