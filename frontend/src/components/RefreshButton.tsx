interface Props { onClick: () => void; spinning: boolean; label?: string }

export default function RefreshButton({ onClick, spinning, label = 'Refresh' }: Props) {
  return (
    <button type="button" onClick={onClick} disabled={spinning} aria-label={label} title={label}
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`}>
        <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />
      </svg>
    </button>
  )
}