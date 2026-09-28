const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'h-4 w-4' }

export function EyeIcon() { return <svg viewBox="0 0 24 24" {...common}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg> }
export function PrinterIcon() { return <svg viewBox="0 0 24 24" {...common}><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" /><rect x="6" y="14" width="12" height="7" /></svg> }
export function DownloadIcon() { return <svg viewBox="0 0 24 24" {...common}><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg> }
export function MailIcon() { return <svg viewBox="0 0 24 24" {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg> }
export function WhatsAppIcon() { return <svg viewBox="0 0 24 24" {...common} fill="currentColor" stroke="none"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.9 14.3c-.3.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.3.6.9 2.1 1 2.2.1.2.1.3 0 .5-.1.2-.2.3-.3.5-.2.2-.3.3-.5.5-.2.2-.4.4-.2.7.2.3.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.7 1.7.3.2.5.1.7-.1.2-.2.8-1 1-1.3.2-.3.4-.3.7-.2.3.1 1.8.9 2.1 1 .3.2.5.2.6.3.1.2.1.9-.2 1.5z" /></svg> }
export function PencilIcon() { return <svg viewBox="0 0 24 24" {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg> }
export function TrashIcon() { return <svg viewBox="0 0 24 24" {...common}><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" /></svg> }
export function BanIcon() { return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></svg> }
export function CheckIcon() { return <svg viewBox="0 0 24 24" {...common}><path d="M20 6L9 17l-5-5" /></svg> }