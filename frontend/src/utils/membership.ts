// A membership's displayed status is derived from today's date, not just its stored
// `status` field - a row can be status="ACTIVE" in the database while still being in the
// future (not started yet) or in the past (lapsed). Only PAUSED and CANCELLED are true
// stored facts (they're the result of an explicit action); everything else is computed
// here so the frontend never has to trust a stale flag.

export type EffectiveStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'PAUSED' | 'CANCELLED'

interface MembershipDates {
  startDate: string
  endDate: string
  status: string
}

export function getEffectiveStatus(m: MembershipDates): EffectiveStatus {
  if (m.status === 'CANCELLED') return 'CANCELLED'
  if (m.status === 'PAUSED') return 'PAUSED'

  const today = new Date().toISOString().slice(0, 10)
  if (m.endDate < today) return 'EXPIRED'
  if (m.startDate > today) return 'SCHEDULED'
  return 'ACTIVE'
}

export function statusColorClass(status: EffectiveStatus): string {
  switch (status) {
    case 'ACTIVE': return 'text-green-700'
    case 'SCHEDULED': return 'text-blue-600'
    case 'PAUSED': return 'text-amber-600'
    case 'CANCELLED': return 'text-gray-400'
    case 'EXPIRED': return 'text-gray-400'
  }
}

export function statusLabel(status: EffectiveStatus): string {
  switch (status) {
    case 'ACTIVE': return 'Active'
    case 'SCHEDULED': return 'Scheduled'
    case 'PAUSED': return 'Paused'
    case 'CANCELLED': return 'Cancelled'
    case 'EXPIRED': return 'Expired'
  }
}
