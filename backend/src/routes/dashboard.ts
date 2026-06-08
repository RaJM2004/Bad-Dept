import { Router } from 'express';
import { getMetrics, getReports, generateReport } from '../controllers/dashboardController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

// @route   GET /dashboard/metrics
// @desc    Get dashboard metrics, aging buckets, charts data
router.get('/metrics', getMetrics as any);

// @route   GET /dashboard/reports
// @desc    Get all reports list
router.get('/reports', getReports as any);

// @route   POST /dashboard/reports
// @desc    Generate a new collection report
router.post('/reports', generateReport as any);

export default router;
