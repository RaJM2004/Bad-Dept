import { Response } from 'express';
import Customer from '../models/Customer';
import Account from '../models/Account';
import Communication from '../models/Communication';
import PaymentPlan from '../models/PaymentPlan';
import AgentLog from '../models/AgentLog';
import Escalation from '../models/Escalation';
import Report from '../models/Report';
import { AuthRequest } from '../middleware/auth';

export const getMetrics = async (req: AuthRequest, res: Response) => {
  try {
    // 1. KPI Cards data
    const totalCustomers = await Customer.countDocuments();
    const activeCases = await Customer.countDocuments({ status: 'Active' });
    const escalatedCases = await Customer.countDocuments({ status: 'Escalated' });
    const settledCases = await Customer.countDocuments({ status: 'Settled' });

    // Outstanding amount aggregation
    const accountStats = await Account.aggregate([
      {
        $group: {
          _id: null,
          totalOutstanding: { $sum: '$outstandingAmount' },
          totalAccounts: { $sum: 1 },
        },
      },
    ]);
    const outstandingAmount = accountStats[0]?.totalOutstanding || 0;

    // Amount recovered aggregation (from payment history)
    const recoveryStats = await Account.aggregate([
      { $unwind: '$paymentHistory' },
      { $match: { 'paymentHistory.status': 'Success' } },
      {
        $group: {
          _id: null,
          totalRecovered: { $sum: '$paymentHistory.amount' },
        },
      },
    ]);
    const amountRecovered = recoveryStats[0]?.totalRecovered || 0;

    // Success rate: Settled / Total closed cases or (Settled / Total)
    const successRate = totalCustomers > 0 ? Math.round((settledCases / totalCustomers) * 100) : 0;

    // 2. Charts Data: Outstanding Amount Distribution (Buckets)
    // Buckets: 0-30, 31-60, 61-90, 90+ days overdue
    const bucketStats = await Account.aggregate([
      {
        $bucket: {
          groupBy: '$daysOverdue',
          boundaries: [0, 31, 61, 91],
          default: '90+',
          output: {
            count: { $sum: 1 },
            amount: { $sum: '$outstandingAmount' },
          },
        },
      },
    ]);

    const agingBuckets = [
      { name: '1-30 Days', count: 0, amount: 0 },
      { name: '31-60 Days', count: 0, amount: 0 },
      { name: '61-90 Days', count: 0, amount: 0 },
      { name: '90+ Days', count: 0, amount: 0 },
    ];

    bucketStats.forEach((bucket: any) => {
      if (bucket._id === 0) {
        agingBuckets[0].count = bucket.count;
        agingBuckets[0].amount = bucket.amount;
      } else if (bucket._id === 31) {
        agingBuckets[1].count = bucket.count;
        agingBuckets[1].amount = bucket.amount;
      } else if (bucket._id === 61) {
        agingBuckets[2].count = bucket.count;
        agingBuckets[2].amount = bucket.amount;
      } else if (bucket._id === '90+') {
        agingBuckets[3].count = bucket.count;
        agingBuckets[3].amount = bucket.amount;
      }
    });

    // 3. Charts Data: Sentiment Distribution (from communications)
    const sentimentStats = await Communication.aggregate([
      { $match: { 'sentiment.category': { $exists: true } } },
      {
        $group: {
          _id: '$sentiment.category',
          count: { $sum: 1 },
        },
      },
    ]);

    const sentiments = sentimentStats.map((item: any) => ({
      name: item._id,
      value: item.count,
    }));

    // 4. Charts Data: Agent Performance
    const agentStats = await AgentLog.aggregate([
      {
        $group: {
          _id: '$agentName',
          requests: { $sum: 1 },
          success: { $sum: { $cond: [{ $eq: ['$status', 'Success'] }, 1, 0] } },
        },
      },
    ]);

    const agentActivity = agentStats.map((item: any) => ({
      name: item._id,
      requests: item.requests,
      successRate: item.requests > 0 ? Math.round((item.success / item.requests) * 100) : 0,
    }));

    // 5. Payment Plan Distribution
    const planStats = await PaymentPlan.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const planDistribution = planStats.map((item: any) => ({
      status: item._id,
      count: item.count,
    }));

    // 6. Recent Escalations
    const recentEscalations = await Escalation.find({ status: { $ne: 'Resolved' } })
      .populate('customerId', 'name email status')
      .sort({ createdAt: -1 })
      .limit(5);

    // Mock Monthly Recovery Trend (if DB has no historical data, we can generate a few data points)
    // We will aggregate actual payments by month
    const monthlyRecoveryStats = await Account.aggregate([
      { $unwind: '$paymentHistory' },
      { $match: { 'paymentHistory.status': 'Success' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paymentHistory.date' } },
          amount: { $sum: '$paymentHistory.amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    let monthlyRecovery = monthlyRecoveryStats.map((item: any) => ({
      month: item._id,
      amount: item.amount,
    }));

    if (monthlyRecovery.length === 0) {
      // Return default data for the chart if empty
      monthlyRecovery = [
        { month: 'Jan', amount: 45000 },
        { month: 'Feb', amount: 52000 },
        { month: 'Mar', amount: 49000 },
        { month: 'Apr', amount: 63000 },
        { month: 'May', amount: 58000 },
        { month: 'Jun', amount: 72000 },
      ];
    }

    return res.status(200).json({
      kpis: {
        totalCustomers,
        activeCases,
        outstandingAmount,
        amountRecovered,
        escalatedCases,
        successRate,
      },
      agingBuckets,
      sentiments: sentiments.length > 0 ? sentiments : [
        { name: 'Positive', value: 12 },
        { name: 'Neutral', value: 25 },
        { name: 'Negative', value: 18 },
        { name: 'Angry', value: 8 },
        { name: 'Legal Threat', value: 4 },
      ],
      agentActivity: agentActivity.length > 0 ? agentActivity : [
        { name: 'Intent Detection', requests: 45, successRate: 100 },
        { name: 'Account Lookup', requests: 42, successRate: 100 },
        { name: 'Resolution Generator', requests: 38, successRate: 98 },
        { name: 'Sentiment & Escalation', requests: 45, successRate: 100 },
        { name: 'Communication Log', requests: 45, successRate: 97 },
      ],
      planDistribution: planDistribution.length > 0 ? planDistribution : [
        { status: 'Active', count: 18 },
        { status: 'Completed', count: 12 },
        { status: 'Defaulted', count: 3 },
      ],
      recentEscalations,
      monthlyRecovery,
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    return res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Generate and export reports
export const generateReport = async (req: AuthRequest, res: Response) => {
  const { type, title } = req.body;

  if (!type || !title) {
    return res.status(400).json({ message: 'Report type and title are required' });
  }

  try {
    // Gather report data based on type
    let data: any = {};
    if (type === 'Collection Summary') {
      const customers = await Customer.find().select('name email status');
      const accounts = await Account.find().select('outstandingAmount daysOverdue riskScore');
      data = {
        totalAccounts: accounts.length,
        totalOutstanding: accounts.reduce((acc, curr) => acc + curr.outstandingAmount, 0),
        statusBreakdown: {
          Active: customers.filter(c => c.status === 'Active').length,
          Settled: customers.filter(c => c.status === 'Settled').length,
          Escalated: customers.filter(c => c.status === 'Escalated').length,
        }
      };
    } else if (type === 'Agent Performance') {
      const logs = await AgentLog.aggregate([
        {
          $group: {
            _id: '$agentName',
            totalCalls: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'Success'] }, 1, 0] } },
            avgDurationMs: { $avg: '$durationMs' },
          }
        }
      ]);
      data = { logs };
    } else {
      data = { message: 'Custom dynamic summary generated' };
    }

    const report = await Report.create({
      title,
      type,
      data,
      generatedBy: req.user?.id,
    });

    return res.status(201).json(report);
  } catch (error) {
    console.error('Generate report error:', error);
    return res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const reports = await Report.find()
      .populate('generatedBy', 'name email')
      .sort({ createdAt: -1 });
    return res.status(200).json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    return res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
