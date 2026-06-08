import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  role: 'Admin' | 'Collection Officer';
  googleId?: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ['Admin', 'Collection Officer'], default: 'Collection Officer' },
    googleId: { type: String },
    avatar: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
