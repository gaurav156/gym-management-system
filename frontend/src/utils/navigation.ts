import type { Role } from '../types'

// Single source of truth for "where does this role land" - previously duplicated
// inline in Navbar and LoginPage, which is how they'd drift if a new role/path pairing
// were added in only one place.
export function getDashboardPath(role: Role): string {
  switch (role) {
    case 'OWNER': return '/owner'
    case 'MANAGER': return '/manager'
    case 'TRAINER': return '/trainer'
    default: return '/member'
  }
}