import { ChangeEvent, useId } from 'react'
import { handleEditPhotoChange } from '../utils/photo'

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

interface Props {
  onLoaded: (dataUrl: string) => void
  onError: (msg: string) => void
  label?: string
  size?: 'sm' | 'md'
}

// Replaces the native <input type="file"> button (which renders as the browser's own
// unstyled "Choose file" control, inconsistent across browsers/OSes) with a button that
// matches the rest of the UI. The actual file input is visually hidden but still present
// and functional - clicking the styled button just forwards the click to it, so this
// keeps native file-picker behavior (mobile camera/gallery prompt, keyboard accessibility
// via the underlying <label>) with none of it visible.
export default function PhotoUploadButton({ onLoaded, onError, label = 'Upload photo', size = 'md' }: Props) {
  const inputId = useId()

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    handleEditPhotoChange(e, onLoaded, onError)
  }

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs gap-1.5'
    : 'px-3 py-2 text-sm gap-2'

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 ${sizeClasses}`}
    >
      <UploadIcon />
      {label}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="sr-only"
      />
    </label>
  )
}