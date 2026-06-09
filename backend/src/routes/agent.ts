import { Router } from 'express';
import {
  detectIntent,
  lookupAccount,
  detectSentimentAndEscalation,
  generateResolution,
  logAndProcessCommunication,
  getAgentLogs,
  generateEmail,
  negotiateRepaymentPlan,
  handleDispute,
  generateAIAnalytics,
} from '../controllers/agentController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

// @route   POST /agents/intent
// @desc    Run Intent Detection Agent
router.post('/intent', detectIntent as any);

// @route   POST /agents/account
// @desc    Run Account Lookup Agent
router.post('/account', lookupAccount as any);

// @route   POST /agents/sentiment
// @desc    Run Sentiment & Escalation Detection Agent
router.post('/sentiment', detectSentimentAndEscalation as any);

// @route   POST /agents/resolution
// @desc    Run Resolution Generator Agent
router.post('/resolution', generateResolution as any);

// @route   POST /agents/generate-email
// @desc    Generate a persuasive collection email
router.post('/generate-email', generateEmail as any);

// @route   POST /agents/log
// @desc    Run Communication Log Agent (coordinates and runs all agents for a message)
router.post('/log', logAndProcessCommunication as any);

// @route   GET /agents/logs
// @desc    Get execution logs for all agents
router.get('/logs', getAgentLogs as any);

// @route   POST /agents/repayment-plan
// @desc    Run Repayment Plans Agent
router.post('/repayment-plan', negotiateRepaymentPlan as any);

// @route   POST /agents/dispute
// @desc    Run Dispute Management Agent
router.post('/dispute', handleDispute as any);

// @route   POST /agents/analytics-report
// @desc    Run Analytics and Report Agent
router.post('/analytics-report', generateAIAnalytics as any);

export default router;
