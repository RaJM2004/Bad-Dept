import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  email: string;
  phone: string;
  status: 'Active' | 'Settled' | 'Disputed' | 'Escalated' | 'Inactive';
  assignedOfficer?: mongoose.Types.ObjectId;
  googleSheetRowId?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ['Active', 'Settled', 'Disputed', 'Escalated', 'Inactive'],
      default: 'Active',
      index: true,
    },
    assignedOfficer: { type: Schema.Types.ObjectId, ref: 'User' },
    googleSheetRowId: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
