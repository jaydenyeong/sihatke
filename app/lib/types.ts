export type StatusLevel = 'great' | 'okay' | 'not_great' | 'need_help';

export interface Checkin {
  _id: string;
  physicalStatus: StatusLevel;
  mentalStatus: StatusLevel;
  note?: string;
  createdAt: string;
}

export interface Contact {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  relationship?: string;
  contactUserId?: string;
  notifyOnHelp: boolean;
  notifyOnMissed: boolean;
  notifyOnDecline: boolean;
  isEmergency: boolean;
  sortOrder: number;
  status: 'active' | 'pending';
  createdAt: string;
}

export interface CircleMember {
  _id: string;
  fullName: string;
  latestCheckin: Checkin | null;
  treeStage: TreeStage;
  currentStreak: number;
}

export type AlertType = 'need_help' | 'missed_checkin' | 'decline_pattern';
export type AlertStatus = 'sent' | 'seen' | 'responded';

export interface Alert {
  _id: string;
  contactId: { _id: string; name: string; relationship?: string };
  alertType: AlertType;
  message?: string;
  status: AlertStatus;
  createdAt: string;
}

export type TreeStage = 1 | 2 | 3 | 4 | 5 | 6;

export interface SunshineReceived {
  fromName: string;
  createdAt: string;
}

export interface CheckinStats {
  currentStreak: number;
  weekDots: boolean[];
  totalCheckins: number;
  treeStage: TreeStage;
  toNextStage: number | null;
  fruitCount: number;
  sunshines: SunshineReceived[];
}
