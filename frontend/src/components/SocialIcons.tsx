// Hand-drawn to match the stroke-icon style already used in Navbar.tsx, rather than
// pulling in an icon library for two glyphs.

export function InstagramIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function FacebookIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 8.5h-2a1.5 1.5 0 0 0-1.5 1.5v2H15l-.4 3h-2.1V21" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}