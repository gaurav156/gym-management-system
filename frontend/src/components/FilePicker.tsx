import { useId } from 'react'
import { UploadIcon } from './icons/ActionIcons'

interface Props {
  file: File | null
  onChange: (file: File | null) => void
  accept?: string
  label?: string
}

export default function FilePicker({ file, onChange, accept, label = 'Choose file' }: Props) {
  const inputId = useId()
  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
      <label htmlFor={inputId}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100">
        <UploadIcon />
        {file ? 'Change file' : label}
        <input id={inputId} type="file" accept={accept} className="sr-only"
          onChange={(e) => { onChange(e.target.files?.[0] ?? null); e.target.value = '' }} />
      </label>
      {file ? (
        <span className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove file"
            className="flex-shrink-0 text-red-500 hover:text-red-700">✕</button>
        </span>
      ) : (
        <span className="text-xs text-gray-400">No file selected</span>
      )}
    </div>
  )
}