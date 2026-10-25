import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { Branch, Plan, ProductCategory } from '../types'

const STATIC = 5 * 60_000
export const NO_BRANCHES: Branch[] = []   // stable reference, avoids effect loops

export const qk = {
  branches: ['branches'] as const,         // prefix: invalidating it clears every branch list
  plans: ['plans'] as const,
  categories: ['product-categories'] as const,
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