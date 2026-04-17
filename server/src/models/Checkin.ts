import { Schema, model, Document, Types } from 'mongoose';

export type StatusLevel = 'great' | 'okay' | 'not_great' | 'need_help';

export interface ICheckin extends Document {
  userId: Types.ObjectId;
  physicalStatus: StatusLevel;
  mentalStatus: StatusLevel;
  note?: string;
  voiceNoteUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const checkinSchema = new Schema<ICheckin>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    physicalStatus: {
      type: String,
      enum: ['great', 'okay', 'not_great', 'need_help'],
      required: true,
    },
    mentalStatus: {
      type: String,
      enum: ['great', 'okay', 'not_great', 'need_help'],
      required: true,
    },
    note: { type: String },
    voiceNoteUrl: { type: String },
  },
  { timestamps: true }
);

export const Checkin = model<ICheckin>('Checkin', checkinSchema);
