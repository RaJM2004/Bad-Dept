import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentHistory {
  date: Date;
  amount: number;
  status: 'Success' | 'Pending' | 'Failed';
}

export interface IContactHistory {
  date: Date;
  channel: 'Email' | 'SMS' | 'Call';
  notes: string;
}

export interface IAccount extends Document {
  customerId: mongoose.Types.ObjectId;
  outstandingAmount: number;
  daysOverdue: number;
  paymentHistory: IPaymentHistory[];
  contactHistory: IContactHistory[];
  riskScore: number; // 0 to 100
  lastPaidDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema: Schema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    outstandingAmount: { type: Number, required: true, min: 0 },
    daysOverdue: { type: Number, required: true, min: 0, index: true },
    paymentHistory: [
      {
        date: { type: Date, required: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['Success', 'Pending', 'Failed'], required: true },
      },
    ],
    contactHistory: [
      {
        date: { type: Date, required: true },
        channel: { type: String, enum: ['Email', 'SMS', 'Call'], required: true },
        notes: { type: String, required: true },
      },
    ],
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    lastPaidDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IAccount>('Account', AccountSchema);
