import { QueryCache, QueryClient } from '@tanstack/react-query'
import { toast, getErrorMessage } from '../store/toastStore'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // One place for "failed to load" toasts, so converted components don't lose their error messages.
    // 401/403 are handled by the axios interceptor (redirect to login).
    onError: (err: any) => {
      const s = err?.response?.status
      if (s === 401 || s === 403) return
      toast.error(getErrorMessage(err, 'Failed to load data'))
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 0,                 // default = show cached instantly, revalidate on mount
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, err: any) => !err?.response && count < 1, // retry network blips only
    },
  },
})