import { Response } from 'express';
import Customer from '../models/Customer';
import Account from '../models/Account';
import Communication from '../models/Communication';
import PaymentPlan from '../models/PaymentPlan';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

// Get all customers (with outstanding amount & accounts info)
export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, assignedToMe } = req.query;
    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (assignedToMe === 'true' && req.user) {
      query.assignedOfficer = req.user.id;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(query)
      .populate('assignedOfficer', 'name email role')
      .sort({ updatedAt: -1 });

    // Populate outstanding details for each customer
    const customersWithDetails = await Promise.all(
      customers.map(async (cust) => {
        const account = await Account.findOne({ customerId: cust._id });
        const paymentPlan = await PaymentPlan.findOne({ customerId: cust._id, status: 'Active' });
        
        return {
          _id: cust._id,
          name: cust.name,
          email: cust.email,
          phone: cust.phone,
          status: cust.status,
          assignedOfficer: cust.assignedOfficer,
          googleSheetRowId: cust.googleSheetRowId,
          createdAt: cust.createdAt,
          updatedAt: cust.updatedAt,
          outstandingAmount: account ? account.outstandingAmount : 0,
          daysOverdue: account ? account.daysOverdue : 0,
          riskScore: account ? account.riskScore : 0,
          hasActivePlan: !!paymentPlan,
        };
      })
    );

    return res.status(200).json(customersWithDetails);
  } catch (error) {
    console.error('Get customers error:', error);
    return res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Get single customer details (including full history)
export const getCustomerById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid customer ID' });
  }

  try {
    const customer = await Customer.findById(id).populate('assignedOfficer', 'name email role');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const account = await Account.findOne({ customerId: customer._id });
    const paymentPlan = await PaymentPlan.findOne({ customerId: customer._id });
    const communications = await Communication.find({ customerId: customer._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      customer,
      account: account || {
        outstandingAmount: 0,
        daysOverdue: 0,
        paymentHistory: [],
        contactHistory: [],
        riskScore: 0,
      },
      paymentPlan: paymentPlan || null,
      communications: communications || [],
    });
  } catch (error) {
    console.error('Get customer details error:', error);
    return res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Create a new Customer
export const createCustomer = async (req: AuthRequest, res: Response) => {
  const { name, email, phone, outstandingAmount, daysOverdue, assignedOfficer } = req.body;

  try {
    // Check if customer exists
    let customer = await Customer.findOne({ email });
    if (customer) {
      return res.status(400).json({ message: 'Customer with this email already exists' });
    }

    // Create Customer
    customer = await Customer.create({
      name,
      email,
      phone,
      assignedOfficer: assignedOfficer || req.user?.id,
      status: 'Active',
    });

    // Create Account for customer
    const account = await Account.create({
      customerId: customer._id,
      outstandingAmount: outstandingAmount || 0,
      daysOverdue: daysOverdue || 0,
      riskScore: daysOverdue ? Math.min(Math.floor(daysOverdue * 1.5), 100) : 0,
      paymentHistory: [],
      contactHistory: [],
    });

    return res.status(201).json({ customer, account });
  } catch (error) {
    console.error('Create customer error:', error);
    return res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Update Customer Status
export const updateCustomerStatus = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, assignedOfficer } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid customer ID' });
  }

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (status) customer.status = status;
    if (assignedOfficer) customer.assignedOfficer = assignedOfficer;

    await customer.save();
    return res.status(200).json(customer);
  } catch (error) {
    console.error('Update customer status error:', error);
    return res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// Record a payment transaction
export const addPaymentTransaction = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { amount, date, status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid customer ID' });
  }

  try {
    const account = await Account.findOne({ customerId: id });
    if (!account) {
      return res.status(404).json({ message: 'Account details not found for this customer' });
    }

    // Add to payment history
    account.paymentHistory.push({
      date: new Date(date || Date.now()),
      amount: Number(amount),
      status: status || 'Success',
    });

    if (status === 'Success') {
      account.outstandingAmount = Math.max(0, account.outstandingAmount - Number(amount));
      account.lastPaidDate = new Date();
      // Recalculate risk score (e.g. decrease if they paid)
      account.riskScore = Math.max(0, account.riskScore - 15);
      
      // Update customer status to Settled if outstanding amount is 0
      if (account.outstandingAmount === 0) {
        await Customer.findByIdAndUpdate(id, { status: 'Settled' });
      }
    }

    await account.save();
    return res.status(200).json(account);
  } catch (error) {
    console.error('Add payment transaction error:', error);
    return res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
