import { Schema, model, Document, Types } from 'mongoose';

export interface IContact extends Document {
  userId: Types.ObjectId;
  contactUserId?: Types.ObjectId;
  name: string;
  phone?: string;
  email?: string;
  relationship?: string;
  notifyOnHelp: boolean;
  notifyOnMissed: boolean;
  notifyOnDecline: boolean;
  isEmergency: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contactUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    phone: { type: String },
    email: { type: String },
    relationship: { type: String },
    notifyOnHelp: { type: Boolean, default: true },
    notifyOnMissed: { type: Boolean, default: true },
    notifyOnDecline: { type: Boolean, default: false },
    isEmergency: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Contact = model<IContact>('Contact', contactSchema);
