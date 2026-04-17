import { Schema, model, Document, Types } from 'mongoose';

export type AlertType = 'need_help' | 'missed_checkin' | 'decline_pattern';
export type AlertStatus = 'sent' | 'seen' | 'responded';

export interface IAlert extends Document {
  userId: Types.ObjectId;
  contactId: Types.ObjectId;
  alertType: AlertType;
  message?: string;
  status: AlertStatus;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
    alertType: {
      type: String,
      enum: ['need_help', 'missed_checkin', 'decline_pattern'],
      required: true,
    },
    message: { type: String },
    status: {
      type: String,
      enum: ['sent', 'seen', 'responded'],
      default: 'sent',
    },
  },
  { timestamps: true }
);

export const Alert = model<IAlert>('Alert', alertSchema);
