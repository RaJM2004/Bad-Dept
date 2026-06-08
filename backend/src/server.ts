import dotenv from 'dotenv';
// Load Environment variables
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { connectDB } from './config/db';

// Route Imports
import authRoutes from './routes/auth';
import customerRoutes from './routes/customer';
import agentRoutes from './routes/agent';
import dashboardRoutes from './routes/dashboard';
import googleRoutes from './routes/googleServices';

// Seed Helper
import Customer from './models/Customer';
import Account from './models/Account';
import User from './models/User';

const app = express();
const PORT = process.env.PORT || 5000;

// Security and Logging Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Turn off for easier development / asset loading
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

// Database Connection
connectDB().then(() => {
  // Seed Database with test data if empty
  seedDatabase();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/gmail', googleRoutes); 
app.use('/api/calendar', googleRoutes); 
app.use('/api/sheets', googleRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Database Seeder
async function seedDatabase() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      // Create seed users
      const admin = await User.create({
        name: 'System Admin',
        email: 'admin@example.com',
        role: 'Admin',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
      });

      const officer = await User.create({
        name: 'Jane Smith',
        email: 'officer@example.com',
        role: 'Collection Officer',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      });

      console.log('Seeded Users: admin@example.com, officer@example.com');

      // Create seed customers and accounts
      const seedCustomers = [
        { name: 'John Doe', email: 'john.doe@example.com', phone: '+1-555-0100', status: 'Active', assignedOfficer: officer._id },
        { name: 'Sarah Jenkins', email: 'sarah.j@example.com', phone: '+1-555-0101', status: 'Active', assignedOfficer: officer._id },
        { name: 'Robert Chen', email: 'robert.chen@example.com', phone: '+1-555-0102', status: 'Escalated', assignedOfficer: officer._id },
        { name: 'Emma Watson', email: 'emma.w@example.com', phone: '+1-555-0103', status: 'Settled', assignedOfficer: officer._id },
        { name: 'Michael Scott', email: 'michael.s@example.com', phone: '+1-555-0104', status: 'Disputed', assignedOfficer: officer._id },
      ];

      const seedAccounts = [
        {
          outstandingAmount: 2500,
          daysOverdue: 45,
          riskScore: 60,
          paymentHistory: [
            { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), amount: 500, status: 'Success' },
            { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), amount: 500, status: 'Failed' },
          ],
          contactHistory: [
            { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), channel: 'Email', notes: 'Sent initial payment reminder.' },
          ],
        },
        {
          outstandingAmount: 8500,
          daysOverdue: 78,
          riskScore: 85,
          paymentHistory: [],
          contactHistory: [
            { date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), channel: 'Email', notes: 'Sent 30-day notice.' },
            { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), channel: 'SMS', notes: 'Automated follow-up sent.' },
          ],
        },
        {
          outstandingAmount: 12000,
          daysOverdue: 112,
          riskScore: 95,
          paymentHistory: [],
          contactHistory: [
            { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), channel: 'Email', notes: 'Sent demand letter.' },
            { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), channel: 'Call', notes: 'No answer. Left voicemail.' },
          ],
        },
        {
          outstandingAmount: 0,
          daysOverdue: 0,
          riskScore: 0,
          lastPaidDate: new Date(),
          paymentHistory: [
            { date: new Date(), amount: 1500, status: 'Success' },
          ],
          contactHistory: [
            { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), channel: 'Email', notes: 'Offered settlement.' },
          ],
        },
        {
          outstandingAmount: 5400,
          daysOverdue: 62,
          riskScore: 75,
          paymentHistory: [],
          contactHistory: [
            { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), channel: 'Email', notes: 'Sent second warning. Customer disputed validity.' },
          ],
        },
      ];

      for (let i = 0; i < seedCustomers.length; i++) {
        const cust = await Customer.create(seedCustomers[i]);
        await Account.create({
          customerId: cust._id,
          ...seedAccounts[i],
        });
      }
      console.log('Seeded Customers & Accounts successfully.');
    }
  } catch (error) {
    console.error('Seeding database failed:', error);
  }
}
