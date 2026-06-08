import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomerStatus,
  addPaymentTransaction,
} from '../controllers/customerController';
import { authenticateJWT, authorizeRole } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

// @route   GET /customers
// @desc    Get all customers with details
router.get('/', getCustomers as any);

// @route   POST /customers
// @desc    Create a new customer (Admin / Officer)
router.post('/', createCustomer as any);

// @route   GET /customers/:id
// @desc    Get customer profile, history, payment plan, communications
router.get('/:id', getCustomerById as any);

// @route   PATCH /customers/:id/status
// @desc    Update customer status or officer assignment
router.patch('/:id/status', updateCustomerStatus as any);

// @route   POST /customers/:id/payment
// @desc    Log a new payment transaction
router.post('/:id/payment', addPaymentTransaction as any);

export default router;
