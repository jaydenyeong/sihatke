import { Schema, model, Document, Types } from 'mongoose';

export interface IPushToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: 'ios' | 'android';
  createdAt: Date;
  updatedAt: Date;
}

const pushTokenSchema = new Schema<IPushToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['ios', 'android'] },
  },
  { timestamps: true }
);

export const PushToken = model<IPushToken>('PushToken', pushTokenSchema);
