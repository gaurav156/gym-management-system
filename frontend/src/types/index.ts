export type Role = 'OWNER' | 'MANAGER' | 'MEMBER' | 'TRAINER'
export type OtpChannel = 'EMAIL' | 'SMS' | 'WHATSAPP'

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
  phone: string | null
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
  invoiceNumber: string
  memberName: string
  recordedByName: string
  planName: string | null
  amount: number
  type: string
  mode: string
  createdAt: string
}

export interface InvoiceResponse {
  paymentId: string
  invoiceNumber: string
  invoiceDate: string
  branchName: string
  branchAddress: string | null
  branchPhone: string | null
  memberName: string
  memberEmail: string
  memberPhone: string | null
  memberAddress: string | null
  planName: string | null
  membershipStartDate: string | null
  membershipEndDate: string | null
  amount: number
  mode: string
  recordedByName: string
  recordedBySignature: string | null
}

export interface Profile {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  photo: string | null
  signature: string | null
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
  branchName: string
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

export interface PersonSummary {
  id: string
  name: string
  email: string
  role: Role
}

export interface MemberSummary {
  id: string
  name: string
  email: string
  phone: string | null
  photo: string | null
  address: string | null
  checkinPin: string | null
  enrollmentDate: string | null
}

export interface HourlyCount {
  hour: number
  count: number
}