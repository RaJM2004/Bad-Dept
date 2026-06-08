import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  title: string;
  type: 'Recovery' | 'Agent Performance' | 'Sentiment' | 'Collection Summary';
  data: any;
  generatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ReportSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ['Recovery', 'Agent Performance', 'Sentiment', 'Collection Summary'],
      required: true,
      index: true,
    },
    data: { type: Schema.Types.Mixed, required: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model<IReport>('Report', ReportSchema);
