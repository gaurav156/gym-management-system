export type Role = 'OWNER' | 'MANAGER' | 'MEMBER' | 'TRAINER'

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
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAUSED'
  pausedAt: string | null
}

export interface MembershipAdmin {
  id: string
  memberId: string
  memberName: string
  planName: string
  startDate: string
  endDate: string
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAUSED'
  pausedAt: string | null
}

export interface Payment {
  id: string
  memberName: string
  recordedByName: string
  planName: string | null
  amount: number
  type: string
  mode: string
  createdAt: string
}

export interface Profile {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  photo: string | null
  role: Role
  enrollmentDate: string | null
  joiningDate: string | null
}

export interface TrainerSummary {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  photo: string | null
  checkinPin: string | null
  joiningDate: string | null
  leftDate: string | null
}

export interface AttendanceLogEntry {
  id: string
  checkInTime: string
  checkOutTime: string | null
  method: string
}

export interface TodayAttendanceEntry {
  personId: string
  personName: string
  role: Role
  checkInTime: string
  checkOutTime: string | null
  method: string
}

export interface LastCheckinEntry {
  personId: string
  lastCheckIn: string
}