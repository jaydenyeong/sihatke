export type StatusLevel = 'great' | 'okay' | 'not_great' | 'need_help';
export type AlertType = 'need_help' | 'missed_checkin' | 'decline_pattern';
export type AlertStatus = 'sent' | 'seen' | 'responded';
export type PushPlatform = 'ios' | 'android';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_url: string | null;
  date_of_birth: string | null;
  checkin_times: string[];
  checkin_frequency: number;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface CheckinRow {
  id: string;
  user_id: string;
  physical_status: StatusLevel;
  mental_status: StatusLevel;
  note: string | null;
  voice_note_url: string | null;
  created_at: string;
}

export interface ContactRow {
  id: string;
  user_id: string;
  contact_user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  notify_on_help: boolean;
  notify_on_missed: boolean;
  notify_on_decline: boolean;
  is_emergency: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AlertRow {
  id: string;
  user_id: string;
  contact_id: string;
  alert_type: AlertType;
  message: string | null;
  status: AlertStatus;
  created_at: string;
  updated_at: string;
}

export interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: PushPlatform;
  created_at: string;
  updated_at: string;
}