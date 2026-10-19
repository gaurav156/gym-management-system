import { ReactNode } from 'react'

type Variant = 'default' | 'primary' | 'danger' | 'success' | 'warning'

// Full literal class names so Tailwind keeps them.
const STYLES: Record<Variant, string> = {
  default: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  primary: 'border-brand/40 bg-brand/5 text-brand hover:bg-brand/10',
  danger:  'border-red-300 bg-white text-red-600 hover:bg-red-50',
  success: 'border-green-300 bg-white text-green-700 hover:bg-green-50',
  warning: 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50',
}

interface Props {
  children: ReactNode
  onClick: () => void
  icon?: ReactNode
  variant?: Variant
  disabled?: boolean
  className?: string
}

export default function ActionButton({ children, onClick, icon, variant = 'default', disabled = false, className = '' }: Props) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${STYLES[variant]} ${className}`}>
      {icon}
      {children}
    </button>
  )
}