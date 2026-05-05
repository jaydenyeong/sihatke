import type {
  UserRow,
  CheckinRow,
  ContactRow,
  AlertRow,
  PushTokenRow,
} from './types';

// API DTOs intentionally use `_id` (mobile app's existing expectation) and
// camelCase fields. Passwords are never returned from these mappers.

export function mapUser(row: UserRow) {
  return {
    _id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    checkinTimes: row.checkin_times,
    checkinFrequency: row.checkin_frequency,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCheckin(row: CheckinRow) {
  return {
    _id: row.id,
    userId: row.user_id,
    physicalStatus: row.physical_status,
    mentalStatus: row.mental_status,
    note: row.note ?? undefined,
    voiceNoteUrl: row.voice_note_url ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapContact(row: ContactRow) {
  return {
    _id: row.id,
    userId: row.user_id,
    contactUserId: row.contact_user_id ?? undefined,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    relationship: row.relationship ?? undefined,
    notifyOnHelp: row.notify_on_help,
    notifyOnMissed: row.notify_on_missed,
    notifyOnDecline: row.notify_on_decline,
    isEmergency: row.is_emergency,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAlert(
  row: AlertRow & {
    contact?: { id: string; name: string; relationship: string | null } | null;
  }
) {
  return {
    _id: row.id,
    userId: row.user_id,
    contactId: row.contact
      ? {
          _id: row.contact.id,
          name: row.contact.name,
          relationship: row.contact.relationship ?? undefined,
        }
      : row.contact_id,
    alertType: row.alert_type,
    message: row.message ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPushToken(row: PushTokenRow) {
  return {
    _id: row.id,
    userId: row.user_id,
    token: row.token,
    platform: row.platform,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}