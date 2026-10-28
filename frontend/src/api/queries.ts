import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { Branch, Plan, ProductCategory } from '../types'
import { queryClient } from './queryClient'
import type { Payment, ProductOrder, MemberSummary, StaffSummary, Expense, PageResponse, HourlyCount, TodayAttendanceEntry, LastCheckinEntry } from '../types'

const STATIC = 5 * 60_000
const SHORT = 30_000
const MEDIUM = 2 * 60_000

export const NO_BRANCHES: Branch[] = []   // stable reference, avoids effect loops

export const qk = {
  branches: ['branches'] as const,         // prefix: invalidating it clears every branch list
  plans: ['plans'] as const,
  categories: ['product-categories'] as const,
  payments: ['payments'] as const,
  productOrders: ['product-orders'] as const,
  members: ['members'] as const,
  staff: ['staff'] as const,
  expenses: ['expenses'] as const,
  attendance: ['attendance'] as const,
}

export const usePlans = () => useQuery({
  queryKey: qk.plans, staleTime: STATIC,
  queryFn: () => api.get<Plan[]>('/api/plans').then((r) => r.data),
})

export const useProductCategories = () => useQuery({
  queryKey: qk.categories, staleTime: STATIC,
  queryFn: () => api.get<ProductCategory[]>('/api/product-categories').then((r) => r.data),
})

export const usePublicBranches = () => useQuery({
  queryKey: [...qk.branches, 'public'], staleTime: STATIC,
  queryFn: () => api.get<Branch[]>('/api/public/branches').then((r) => r.data),
})

export const useOwnerBranches = (enabled = true) => useQuery({
  queryKey: [...qk.branches, 'all'], staleTime: STATIC, enabled,
  queryFn: () => api.get<Branch[]>('/api/branches').then((r) => r.data),
})

export const useMyBranches = (userId: string | undefined) => useQuery({
  queryKey: [...qk.branches, 'mine', userId], staleTime: STATIC, enabled: !!userId,
  queryFn: () => api.get<Branch[]>('/api/branches/mine', { params: { userId } }).then((r) => r.data),
})

// Owner sees every branch; everyone else sees their assigned ones.
export function useAccessibleBranches(role: string | undefined, userId: string | undefined) {
  const owner = role === 'OWNER'
  const all = useOwnerBranches(owner)
  const mine = useMyBranches(owner ? undefined : userId)
  return { branches: (owner ? all.data : mine.data) ?? NO_BRANCHES, isLoading: owner ? all.isLoading : mine.isLoading }
}

// While the next page loads, keep showing the previous page, but never another branch's data.
function keepForBranch<T>(branchId: string) {
  return (prev: T | undefined, prevQuery?: { queryKey: readonly unknown[] }) =>
    prevQuery?.queryKey.includes(branchId) ? prev : undefined
}

export const usePayments = (branchId: string, page: number, size: number) => useQuery({
  queryKey: [...qk.payments, 'branch', branchId, page, size],
  enabled: !!branchId, staleTime: SHORT,
  placeholderData: keepForBranch<PageResponse<Payment>>(branchId),
  queryFn: () => api.get<PageResponse<Payment>>(`/api/payments/branch/${branchId}`, { params: { page, size } }).then((r) => r.data),
})

export const useBranchOrders = (branchId: string, page: number, size: number) => useQuery({
  queryKey: [...qk.productOrders, 'branch', branchId, page, size],
  enabled: !!branchId, staleTime: SHORT,
  placeholderData: keepForBranch<PageResponse<ProductOrder>>(branchId),
  queryFn: () => api.get<PageResponse<ProductOrder>>(`/api/product-orders/branch/${branchId}`, { params: { page, size } }).then((r) => r.data),
})

export const useExpenses = (branchId: string, page: number, size: number) => useQuery({
  queryKey: [...qk.expenses, 'branch', branchId, page, size],
  enabled: !!branchId, staleTime: MEDIUM,
  placeholderData: keepForBranch<PageResponse<Expense>>(branchId),
  queryFn: () => api.get<PageResponse<Expense>>(`/api/expenses/branch/${branchId}`, { params: { page, size } }).then((r) => r.data),
})

export interface MemberListParams { branchId: string; search: string; status: string; sort: string; page: number; size: number }
export const useMembers = (p: MemberListParams) => useQuery({
  queryKey: [...qk.members, p.branchId, p.search, p.status, p.sort, p.page, p.size],
  enabled: !!p.branchId, staleTime: MEDIUM,
  placeholderData: keepForBranch<PageResponse<MemberSummary>>(p.branchId),
  queryFn: () => api.get<PageResponse<MemberSummary>>('/api/members', {
    params: { branchId: p.branchId, search: p.search || undefined, status: p.status, sort: p.sort, page: p.page, size: p.size },
  }).then((r) => r.data),
})

export interface StaffListParams { branchId: string; role: string; includeLeft: boolean; sort: string; page: number; size: number }
export const useStaff = (p: StaffListParams) => useQuery({
  queryKey: [...qk.staff, p.branchId, p.role, p.includeLeft, p.sort, p.page, p.size],
  enabled: !!p.branchId, staleTime: MEDIUM,
  placeholderData: keepForBranch<PageResponse<StaffSummary>>(p.branchId),
  queryFn: () => api.get<PageResponse<StaffSummary>>('/api/staff', {
    params: { branchId: p.branchId, role: p.role, includeLeft: p.includeLeft, sort: p.sort, page: p.page, size: p.size },
  }).then((r) => r.data),
})

// date undefined = today. live = also auto-refresh every 60s while mounted (reception screen only).
export const useAttendanceSummary = (branchId: string, date?: string, live = false) => useQuery({
  queryKey: [...qk.attendance, 'summary', branchId, date ?? 'today'],
  enabled: !!branchId, staleTime: SHORT, refetchInterval: live ? 60_000 : false,
  queryFn: () => api.get<HourlyCount[]>(`/api/attendance/summary/${branchId}`, { params: { date } }).then((r) => r.data),
})

export const useTodayAttendance = (branchId: string, date?: string, live = false) => useQuery({
  queryKey: [...qk.attendance, 'today', branchId, date ?? 'today'],
  enabled: !!branchId, staleTime: SHORT, refetchInterval: live ? 60_000 : false,
  queryFn: () => api.get<TodayAttendanceEntry[]>(`/api/attendance/today/${branchId}`, { params: { date } }).then((r) => r.data),
})

export const useLastCheckins = (branchId: string) => useQuery({
  queryKey: [...qk.attendance, 'last', branchId],
  enabled: !!branchId, staleTime: MEDIUM,
  queryFn: () => api.get<LastCheckinEntry[]>(`/api/attendance/last-checkin/${branchId}`).then((r) => r.data),
})

// Role change / delete / branch assignment can move someone between the Members and Staff lists.
export const invalidatePeople = () =>
  Promise.all([qk.members, qk.staff].map((k) => queryClient.invalidateQueries({ queryKey: k })))

// A purchase or payment changes both the payments list and a member's status badge.
export const invalidateMembershipData = () =>
  Promise.all([qk.members, qk.payments].map((k) => queryClient.invalidateQueries({ queryKey: k })))