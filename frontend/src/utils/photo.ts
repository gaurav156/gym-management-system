import { ChangeEvent } from 'react'

export const MAX_PHOTO_BYTES = 1_500_000 // ~1.5MB - base64 in a DB column, keep it modest

// onError lets each caller report into whichever component's own message state it's
// operating in, rather than this shared helper guessing or reaching into unrelated state.
export function handleEditPhotoChange(
  e: ChangeEvent<HTMLInputElement>,
  onLoaded: (dataUrl: string) => void,
  onError: (msg: string) => void
) {
  const file = e.target.files?.[0]
  const inputEl = e.target
  if (!file) return
  if (file.size > MAX_PHOTO_BYTES) {
    onError('Photo is too large - please use one under ~1.5MB.')
    inputEl.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => onLoaded(reader.result as string)
  reader.readAsDataURL(file)
  inputEl.value = ''
}