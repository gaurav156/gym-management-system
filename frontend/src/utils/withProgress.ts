import { toast, getErrorMessage } from '../store/toastStore'

// Shows a "working" toast (duration 0 = stays until dismissed) for the life of a slow
// action, then removes it whether the action succeeded or failed. Errors are reported
// here, so callers don't need their own try/catch. Resolves to undefined on failure.
export async function withProgress<T>(
  message: string,
  task: () => Promise<T>,
  errorFallback = 'Something went wrong',
): Promise<T | undefined> {
  const id = toast.info(message, { duration: 0 })
  try {
    return await task()
  } catch (err) {
    toast.error(getErrorMessage(err, errorFallback))
    return undefined
  } finally {
    toast.dismiss(id)
  }
}