import mongoose, { Schema, Document } from 'mongoose';

export interface ICommunication extends Document {
  customerId: mongoose.Types.ObjectId;
  sender: 'Customer' | 'Agent' | 'Officer';
  messageType: 'Email' | 'SMS' | 'System';
  content: string;
  intent?: {
    category: 'Payment Commitment' | 'Payment Plan Request' | 'Already Paid' | 'Dispute' | 'Refusal To Pay' | 'General Inquiry' | 'Unknown';
    confidence: number;
  };
  sentiment?: {
    category: 'Positive' | 'Neutral' | 'Negative' | 'Angry' | 'Legal Threat';
    confidence: number;
  };
  responseGenerated?: string;
  responseSent: boolean;
  gmailMessageId?: string;
  createdAt: Date;
}

const CommunicationSchema: Schema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    sender: { type: String, enum: ['Customer', 'Agent', 'Officer'], required: true },
    messageType: { type: String, enum: ['Email', 'SMS', 'System'], required: true },
    content: { type: String, required: true },
    intent: {
      category: {
        type: String,
        enum: ['Payment Commitment', 'Payment Plan Request', 'Already Paid', 'Dispute', 'Refusal To Pay', 'General Inquiry', 'Unknown'],
      },
      confidence: { type: Number },
    },
    sentiment: {
      category: {
        type: String,
        enum: ['Positive', 'Neutral', 'Negative', 'Angry', 'Legal Threat'],
      },
      confidence: { type: Number },
    },
    responseGenerated: { type: String },
    responseSent: { type: Boolean, default: false },
    gmailMessageId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<ICommunication>('Communication', CommunicationSchema);
