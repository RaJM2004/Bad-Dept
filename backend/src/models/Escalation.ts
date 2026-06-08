import mongoose, { Schema, Document } from 'mongoose';

export interface IEscalation extends Document {
  customerId: mongoose.Types.ObjectId;
  reason: string;
  status: 'Pending' | 'Resolved' | 'In Progress';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  notes?: string;
  assignedTo?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EscalationSchema: Schema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Resolved', 'In Progress'], default: 'Pending', index: true },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium', index: true },
    notes: { type: String },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model<IEscalation>('Escalation', EscalationSchema);
