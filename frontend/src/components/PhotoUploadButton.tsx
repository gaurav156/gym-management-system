import { ChangeEvent, useId, useState } from 'react'
import { handleEditPhotoChange, type ImagePurpose } from '../utils/photo'
import Spinner from './Spinner'

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
  onLoaded: (url: string) => void
  onError: (msg: string) => void
  label?: string
  size?: 'sm' | 'md'
  purpose?: ImagePurpose
  accept?: string
}

// The file is uploaded as soon as it's picked; onLoaded receives the resulting URL, which
// is what gets submitted with the surrounding form (the form itself never carries image bytes).
export default function PhotoUploadButton({ onLoaded, onError, label = 'Upload photo', size = 'md', purpose = 'PHOTO', accept = 'image/*' }: Props) {
  const inputId = useId()
  const [uploading, setUploading] = useState(false)

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setUploading(true)
    try {
      await handleEditPhotoChange(e, onLoaded, onError, purpose)
    } finally {
      setUploading(false)
    }
  }

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs gap-1.5'
    : 'px-3 py-2 text-sm gap-2'

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 ${sizeClasses} ${
        uploading ? 'pointer-events-none opacity-70' : ''
      }`}
    >
      {uploading ? <Spinner className="h-4 w-4" /> : <UploadIcon />}
      {uploading ? 'Uploading...' : label}
      <input id={inputId} type="file" accept={accept} disabled={uploading} onChange={handleChange} className="sr-only" />
    </label>
  )
}