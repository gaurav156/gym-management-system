export type Role = 'OWNER' | 'MANAGER' | 'MEMBER'

export interface AuthUser {
  token: string
  userId: string
  name: string
  email: string
  role: Role
}

export interface Branch {
  id: string
  name: string
  address: string
}

export interface Plan {
  id: string
  name: string
  durationMonths: number
  price: number
}

export interface Membership {
  id: string
  planName: string
  startDate: string
  endDate: string
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
}
