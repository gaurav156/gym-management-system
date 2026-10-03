import type { BroadcastAudience, BroadcastChannel, BroadcastType } from '../../types'

export const AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: 'ALL_USERS', label: 'All users' },
  { value: 'ALL_MEMBERS', label: 'All members' },
  { value: 'ACTIVE_MEMBERS', label: 'All active members' },
  { value: 'INACTIVE_MEMBERS', label: 'All inactive members' },
  { value: 'ALL_STAFF', label: 'All staff (Owners, Managers, Trainers)' },
  { value: 'ALL_TRAINERS', label: 'All trainers' },
  { value: 'ALL_MANAGERS', label: 'All managers' },
  { value: 'ALL_OWNERS', label: 'All owners' },
]

export const CHANNEL_LABELS: Record<BroadcastChannel, string> = {
  EMAIL: 'Email', SMS: 'SMS', WHATSAPP: 'WhatsApp',
}

export const TYPE_LABELS: Record<BroadcastType, string> = {
  ANNOUNCEMENT: 'Announcement', PROMOTIONAL: 'Promotional',
}

export function audienceLabel(a: BroadcastAudience): string {
  return AUDIENCES.find((x) => x.value === a)?.label ?? a
}