import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentScheduleItem {
  dueDate: Date;
  amount: number;
  paidDate?: Date;
  status: 'Unpaid' | 'Paid' | 'Overdue';
}

export interface IPaymentPlan extends Document {
  customerId: mongoose.Types.ObjectId;
  totalAmount: number;
  emiAmount: number;
  frequency: 'Monthly' | 'Weekly';
  installmentsCount: number;
  paidInstallmentsCount: number;
  startDate: Date;
  status: 'Active' | 'Completed' | 'Defaulted';
  schedule: IPaymentScheduleItem[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentPlanSchema: Schema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    totalAmount: { type: Number, required: true, min: 0 },
    emiAmount: { type: Number, required: true, min: 0 },
    frequency: { type: String, enum: ['Monthly', 'Weekly'], default: 'Monthly' },
    installmentsCount: { type: Number, required: true, min: 1 },
    paidInstallmentsCount: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, required: true },
    status: { type: String, enum: ['Active', 'Completed', 'Defaulted'], default: 'Active', index: true },
    schedule: [
      {
        dueDate: { type: Date, required: true },
        amount: { type: Number, required: true },
        paidDate: { type: Date },
        status: { type: String, enum: ['Unpaid', 'Paid', 'Overdue'], default: 'Unpaid' },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IPaymentPlan>('PaymentPlan', PaymentPlanSchema);
