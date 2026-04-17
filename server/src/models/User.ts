import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  fullName: string;
  avatarUrl?: string;
  dateOfBirth?: Date;
  checkinTimes: string[];
  checkinFrequency: number;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    dateOfBirth: { type: Date },
    checkinTimes: { type: [String], default: ['09:00'] },
    checkinFrequency: { type: Number, default: 1 },
    timezone: { type: String, default: 'UTC' },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
