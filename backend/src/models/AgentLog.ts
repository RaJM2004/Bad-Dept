import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentLog extends Document {
  agentName: 'Intent Detection' | 'Account Lookup' | 'Resolution Generator' | 'Sentiment & Escalation' | 'Communication Log' | 'Repayment Plans' | 'Dispute Management' | 'Analytics & Report';
  status: 'Success' | 'Error';
  requestDetails: any;
  responseDetails: any;
  durationMs: number;
  errorMessage?: string;
  createdAt: Date;
}

const AgentLogSchema: Schema = new Schema(
  {
    agentName: {
      type: String,
      enum: ['Intent Detection', 'Account Lookup', 'Resolution Generator', 'Sentiment & Escalation', 'Communication Log', 'Repayment Plans', 'Dispute Management', 'Analytics & Report'],
      required: true,
      index: true,
    },
    status: { type: String, enum: ['Success', 'Error'], required: true, index: true },
    requestDetails: { type: Schema.Types.Mixed },
    responseDetails: { type: Schema.Types.Mixed },
    durationMs: { type: Number, required: true },
    errorMessage: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IAgentLog>('AgentLog', AgentLogSchema);
