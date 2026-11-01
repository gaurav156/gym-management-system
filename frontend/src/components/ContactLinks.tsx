import ActionButton from './ActionButton'
import { PhoneIcon, WhatsAppIcon, SmsIcon } from './icons/ActionIcons'

// Keeps digits and a leading + so numbers typed as "98765 43210" or "(022) 123-456" still dial.
const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`

export function PhoneLink({ phone }: { phone: string | null | undefined }) {
  if (!phone) return <>—</>
  return <a href={telHref(phone)} className="text-brand hover:underline">{phone}</a>
}

export function EmailLink({ email }: { email: string | null | undefined }) {
  if (!email) return <>—</>
  return <a href={`mailto:${email}`} className="break-all text-brand hover:underline">{email}</a>
}

const noop = () => {}

// Call works today (opens the phone app). WhatsApp/SMS are placeholders until a provider is wired
// (see InvoiceWhatsAppService / SmsOtpDeliveryService) - swap `disabled` for a real onClick then.
export function ContactActions({ phone }: { phone: string | null | undefined }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {phone ? (
        <a href={telHref(phone)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-green-300 bg-white px-2.5 py-1 text-xs font-medium text-green-700 shadow-sm transition-colors hover:bg-green-50">
          <PhoneIcon /> Call
        </a>
      ) : (
        <ActionButton disabled icon={<PhoneIcon />} onClick={noop}>Call</ActionButton>
      )}
      <ActionButton disabled icon={<WhatsAppIcon />} onClick={noop}>WhatsApp (soon)</ActionButton>
      <ActionButton disabled icon={<SmsIcon />} onClick={noop}>SMS (soon)</ActionButton>
    </div>
  )
}