import { Router } from 'express';
import {
  sendGmailMessage,
  getInbox,
  createCalendarEvent,
  importFromSheets,
  exportToSheets,
} from '../controllers/googleController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

// @route   POST /gmail/send
// @desc    Send automated email using Gmail API or mock SMTP
router.post('/send', sendGmailMessage as any);

// @route   GET /gmail/inbox
// @desc    Get emails from user's inbox
router.get('/inbox', getInbox as any);

// @route   POST /calendar/create-event
// @desc    Schedule calendar follow-up using Google Calendar API
router.post('/create-event', createCalendarEvent as any);

// @route   POST /sheets/import
// @desc    Import customer data from Google Sheets
router.post('/import', importFromSheets as any);

// @route   POST /sheets/export
// @desc    Export recovery report to Google Sheets
router.post('/export', exportToSheets as any);

export default router;
