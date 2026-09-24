export type Role = 'OWNER' | 'MANAGER' | 'MEMBER' | 'TRAINER'
export type OtpChannel = 'EMAIL' | 'SMS' | 'WHATSAPP'
export type ExpenseCategory = 'SALARY' | 'UTILITY' | 'RENT' | 'EQUIPMENT' | 'MAINTENANCE' | 'OTHER'
export type DiscountType = 'PERCENTAGE' | 'FIXED'
export type ProductOrderStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

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

export interface StaffSummary {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  photo: string | null
  checkinPin: string | null
  role: Role
  joiningDate: string | null
  leftDate: string | null
}

export interface RoleHistoryEntry {
  previousRole: string
  newRole: string
  changedByName: string
  changedAt: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export interface Expense {
  id: string
  branchId: string
  branchName: string
  category: ExpenseCategory
  amount: number
  expenseDate: string
  remark: string | null
  billUrl: string | null
  recordedByName: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  discountPrice: number | null
  discountStartsAt: string | null
  discountEndsAt: string | null
  effectivePrice: number
  discountActive: boolean
  stockQuantity: number
  outOfStock: boolean
  active: boolean
  imageUrls: string[]
}

export interface Coupon {
  id: string
  code: string
  description: string | null
  discountType: DiscountType
  discountValue: number
  startsAt: string | null
  endsAt: string | null
  active: boolean
  firstTimeBuyersOnly: boolean
  maxRedemptions: number | null
  timesRedeemed: number
  currentlyValid: boolean
}

export interface ProductOrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface ProductOrder {
  id: string
  invoiceNumber: string
  memberId: string
  memberName: string
  branchId: string
  branchName: string
  items: ProductOrderItem[]
  subtotal: number
  discountAmount: number
  couponCode: string | null
  totalAmount: number
  mode: string
  status: ProductOrderStatus
  recordedByName: string | null
  createdAt: string
  completedAt: string | null
  cancelledAt: string | null
  refundAmount: number | null
  refundedByName: string | null
  refundNote: string | null
}