import type { Gender } from '../types'
import { formatDateLabel } from './date'

export function genderLabel(g: Gender | null | undefined): string {
  return g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : g === 'OTHER' ? 'Other' : '—'
}

// Age in whole years from a yyyy-MM-dd date of birth, computed in the browser's local date.
export function calculateAge(dobIso: string, today: Date = new Date()): number | null {
  const [y, m, d] = dobIso.split('-').map(Number)
  if (!y || !m || !d) return null
  let age = today.getFullYear() - y
  const month = today.getMonth() + 1
  if (month < m || (month === m && today.getDate() < d)) age--
  return age >= 0 ? age : null
}

export function formatDobWithAge(dobIso: string | null | undefined): string {
  if (!dobIso) return '—'
  const age = calculateAge(dobIso)
  return age == null ? formatDateLabel(dobIso) : `${formatDateLabel(dobIso)} (${age} year${age === 1 ? '' : 's'})`
}