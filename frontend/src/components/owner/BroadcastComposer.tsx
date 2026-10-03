import { FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import DescriptionEditor from './DescriptionEditor'
import PhotoUploadButton from '../PhotoUploadButton'
import Spinner from '../Spinner'
import ConfirmDialog from '../ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import { AUDIENCES, CHANNEL_LABELS, audienceLabel } from './broadcastConstants'
import { BROADCAST_TEMPLATES } from './broadcastTemplates'
import type {
  BroadcastAttachmentInput, BroadcastAudience, BroadcastChannel, BroadcastFormat, BroadcastPreview,
  BroadcastType, ChannelAvailability,
} from '../../types'

const SMS_MAX = 600
const MAX_ATTACHMENTS = 3

interface Props {
  anySending: boolean
  onSent: () => void
}

export default function BroadcastComposer({ anySending, onSent }: Props) {
  const [channels, setChannels] = useState<ChannelAvailability[]>([])
  const [channel, setChannel] = useState<BroadcastChannel>('EMAIL')
  const [audience, setAudience] = useState<BroadcastAudience>('ALL_MEMBERS')
  const [type, setType] = useState<BroadcastType>('ANNOUNCEMENT')
  const [format, setFormat] = useState<BroadcastFormat>('DESIGNER')
  const [subject, setSubject] = useState('')

  // One body per mode, so switching tabs never destroys what was typed in another.
  const [designerBody, setDesignerBody] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [plainBody, setPlainBody] = useState('')

  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [accent, setAccent] = useState('#e11d48')
  const [attachments, setAttachments] = useState<BroadcastAttachmentInput[]>([])

  const [counts, setCounts] = useState<BroadcastPreview | null>(null)
  const [countsLoading, setCountsLoading] = useState(false)

  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const previewTicket = useRef(0)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [testSending, setTestSending] = useState(false)
  const htmlRef = useRef<HTMLTextAreaElement>(null)
  const { confirm, dialogProps } = useConfirm()

  const isEmail = channel === 'EMAIL'
  const effectiveFormat: BroadcastFormat = isEmail ? format : 'PLAIN'
  const body = effectiveFormat === 'DESIGNER' ? designerBody : effectiveFormat === 'HTML' ? htmlBody : plainBody

  function buildPayload() {
    return {
      channel, audience, type,
      format: effectiveFormat,
      subject: isEmail ? subject.trim() : null,
      body: body.trim(),
      bannerUrl: effectiveFormat === 'DESIGNER' ? bannerUrl : null,
      ctaLabel: effectiveFormat === 'DESIGNER' ? ctaLabel.trim() || null : null,
      ctaUrl: effectiveFormat === 'DESIGNER' ? ctaUrl.trim() || null : null,
      accentColor: effectiveFormat === 'DESIGNER' ? accent : null,
      attachments: isEmail ? attachments : [],
    }
  }
  const payload = buildPayload()
  const previewKey = JSON.stringify({ ...payload, audience: null })

  useEffect(() => {
    api.get<ChannelAvailability[]>('/api/owner/broadcasts/channels').then((res) => setChannels(res.data))
  }, [])

  function isAvailable(c: BroadcastChannel): boolean {
    return channels.find((x) => x.channel === c)?.available ?? c === 'EMAIL'
  }

  // Live "will send to N people" - depends on audience, channel AND type (consent filtering).
  useEffect(() => {
    setCountsLoading(true)
    const handle = setTimeout(() => {
      api.get<BroadcastPreview>('/api/owner/broadcasts/preview', { params: { audience, channel, type } })
        .then((res) => setCounts(res.data))
        .catch(() => setCounts(null))
        .finally(() => setCountsLoading(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [audience, channel, type])

  // Live preview comes from the SERVER renderer - the same code that sends - so it can't drift.
  useEffect(() => {
    const ticket = ++previewTicket.current
    if (!isEmail || !payload.body) {
      setPreviewHtml(''); setPreviewError(''); setPreviewLoading(false)
      return
    }
    setPreviewLoading(true)
    const handle = setTimeout(() => {
      api.post<{ html: string; text: string }>('/api/owner/broadcasts/render', payload)
        .then((res) => { if (ticket === previewTicket.current) { setPreviewHtml(res.data.html); setPreviewError('') } })
        .catch((err) => { if (ticket === previewTicket.current) setPreviewError(err.response?.data?.error || 'Preview failed') })
        .finally(() => { if (ticket === previewTicket.current) setPreviewLoading(false) })
    }, 600)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey])

  function insertImageIntoHtml(url: string) {
    const el = htmlRef.current
    const s = el?.selectionStart ?? htmlBody.length
    const e = el?.selectionEnd ?? htmlBody.length
    const snippet = `<img src="${url}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />`
    setHtmlBody((b) => b.slice(0, s) + snippet + b.slice(e))
  }

  function applyTemplate(id: string) {
    const t = BROADCAST_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    if (htmlBody.trim()) {
      confirm({
        title: 'Replace HTML?',
        message: `Loading the "${t.label}" template replaces everything in the HTML editor.`,
        confirmLabel: 'Replace',
        onConfirm: () => setHtmlBody(t.html),
      })
    } else {
      setHtmlBody(t.html)
    }
  }

  const canSend = !!body.trim() && (!isEmail || !!subject.trim())
    && !!counts && counts.eligibleRecipients > 0 && !anySending

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setMessage('')
    if (!canSend || !counts) return

    const notes: string[] = []
    if (counts.optedOut > 0) notes.push(`${counts.optedOut} opted out of promotions`)
    if (counts.missingContact > 0) notes.push(`${counts.missingContact} have no ${isEmail ? 'email' : 'phone number'}`)

    confirm({
      title: 'Send broadcast',
      message: `Send this ${type === 'PROMOTIONAL' ? 'promotional' : 'announcement'} ${CHANNEL_LABELS[channel]} message to `
        + `${counts.eligibleRecipients} recipient${counts.eligibleRecipients === 1 ? '' : 's'} (${audienceLabel(audience)})?`
        + `${notes.length ? ` Skipped: ${notes.join(', ')}.` : ''} It can't be recalled once sent.`,
      confirmLabel: 'Send now',
      danger: true,
      onConfirm: async () => {
        try {
          await api.post('/api/owner/broadcasts', payload)
          setSubject(''); setDesignerBody(''); setHtmlBody(''); setPlainBody('')
          setBannerUrl(null); setCtaLabel(''); setCtaUrl(''); setAttachments([])
          setMessage('Broadcast queued - delivery is in progress, see the history below.')
          onSent()
        } catch (err: any) {
          setError(err.response?.data?.error || 'Failed to send broadcast')
        }
      },
    })
  }

  async function sendTest() {
    setError(''); setMessage('')
    if (!body.trim() || !subject.trim()) { setError('Add a subject and a message first.'); return }
    setTestSending(true)
    try {
      const { data } = await api.post<{ message: string }>('/api/owner/broadcasts/test', payload)
      setMessage(data.message)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send test email')
    } finally {
      setTestSending(false)
    }
  }

  const tabClass = (active: boolean) =>
    `-mb-px border-b-2 px-3 py-2 text-sm ${active ? 'border-brand font-medium text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="block text-xs text-gray-500">Send via</label>
        <div className="mt-1 flex flex-wrap gap-2 text-sm">
          {(['EMAIL', 'SMS', 'WHATSAPP'] as BroadcastChannel[]).map((c) => {
            const available = isAvailable(c)
            return (
              <button key={c} type="button" disabled={!available} onClick={() => setChannel(c)}
                title={available ? undefined : 'Coming soon'}
                className={`rounded-md border px-3 py-1.5 disabled:cursor-not-allowed ${
                  channel === c ? 'border-brand bg-brand/10 text-brand'
                    : available ? 'border-gray-300 text-gray-600' : 'border-gray-200 text-gray-400'
                }`}>
                {CHANNEL_LABELS[c]}{available ? '' : ' (soon)'}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500">Message type</label>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {([
            ['ANNOUNCEMENT', 'Important announcement', 'Updates people need to know (timings, closures, policy). Sent to everyone in the audience.'],
            ['PROMOTIONAL', 'Promotional', 'Offers and marketing. Only sent to people who agreed to receive them; includes an unsubscribe link.'],
          ] as [BroadcastType, string, string][]).map(([value, title, help]) => (
            <label key={value} className={`cursor-pointer rounded-md border p-3 text-sm ${
              type === value ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="radio" className="mr-2" checked={type === value} onChange={() => setType(value)} />
              <span className="font-medium">{title}</span>
              <p className="mt-1 text-xs text-gray-500">{help}</p>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500">Send to</label>
        <select value={audience} onChange={(e) => setAudience(e.target.value as BroadcastAudience)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto">
          {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {countsLoading || !counts ? 'Counting recipients...' : (
            <>
              <span className="font-medium text-gray-700">{counts.eligibleRecipients}</span> recipient{counts.eligibleRecipients === 1 ? '' : 's'}
              {counts.optedOut > 0 && <span className="text-amber-600"> · {counts.optedOut} opted out of promotions</span>}
              {counts.missingContact > 0 && <span className="text-amber-600"> · {counts.missingContact} skipped (no {isEmail ? 'email' : 'phone number'})</span>}
            </>
          )}
        </p>
        {audience === 'ACTIVE_MEMBERS' && (
          <p className="mt-0.5 text-[11px] text-gray-400">Active = has a membership plan running today. Paused, expired and no-plan members count as inactive.</p>
        )}
      </div>

      {isEmail && (
        <input placeholder="Subject" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      )}

      {isEmail && (
        <div className="flex gap-1 border-b border-gray-200">
          <button type="button" onClick={() => setFormat('DESIGNER')} className={tabClass(format === 'DESIGNER')}>Designer</button>
          <button type="button" onClick={() => setFormat('HTML')} className={tabClass(format === 'HTML')}>Custom HTML</button>
          <button type="button" onClick={() => setFormat('PLAIN')} className={tabClass(format === 'PLAIN')}>Plain text</button>
        </div>
      )}

      {effectiveFormat === 'DESIGNER' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500">Banner image (optional, shown at the top)</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {bannerUrl && <img src={bannerUrl} alt="" className="h-14 rounded border border-gray-200 object-cover" />}
              <PhotoUploadButton purpose="BROADCAST_IMAGE" size="sm" label={bannerUrl ? 'Replace banner' : 'Upload banner'}
                onLoaded={(url) => setBannerUrl(url)} onError={setError} />
              {bannerUrl && <button type="button" onClick={() => setBannerUrl(null)} className="text-xs text-red-600 hover:underline">Remove</button>}
            </div>
          </div>

          <DescriptionEditor value={designerBody} onChange={setDesignerBody} rows={8} />
          <p className="text-[11px] text-gray-400">
            Use the toolbar for bold, headings, lists and links. Type <code>{'{{name}}'}</code> to insert each person's name.
            A greeting ("Hi Name,") is added automatically.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <input placeholder="Button label (optional)" maxLength={60} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Button link https://..." maxLength={500} value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-1" />
            <label className="flex items-center gap-2 text-xs text-gray-500">
              Accent colour
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-0.5" />
            </label>
          </div>
        </div>
      )}

      {effectiveFormat === 'HTML' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select value="" onChange={(e) => applyTemplate(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-xs">
              <option value="">Start from a template...</option>
              {BROADCAST_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <PhotoUploadButton purpose="BROADCAST_IMAGE" size="sm" label="Insert image"
              onLoaded={(url) => insertImageIntoHtml(url)} onError={setError} />
          </div>
          <textarea ref={htmlRef} value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} rows={14} spellCheck={false}
            placeholder="<table>...</table> - use inline style=&quot;...&quot; attributes"
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs" />
          <p className="text-[11px] text-gray-400">
            Use tables and inline <code>style=""</code> - that's what email apps support. Scripts, forms, iframes and
            <code> &lt;style&gt;</code> blocks are removed. Use <code>{'{{name}}'}</code> for each person's name. Use
            "Send test to me" to check it in a real inbox.
          </p>
        </div>
      )}

      {effectiveFormat === 'PLAIN' && (
        <div>
          <textarea placeholder="Message" rows={6} maxLength={channel === 'SMS' ? SMS_MAX : 5000} value={plainBody}
            onChange={(e) => setPlainBody(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <p className="mt-0.5 text-right text-[11px] text-gray-400">{plainBody.length} / {channel === 'SMS' ? SMS_MAX : 5000}</p>
        </div>
      )}

      {isEmail && (
        <div>
          <label className="block text-xs text-gray-500">Attachments (images or PDFs, up to {MAX_ATTACHMENTS})</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {attachments.map((a, i) => (
              <span key={a.url} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
                {a.filename}
                <button type="button" onClick={() => setAttachments((list) => list.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700">✕</button>
              </span>
            ))}
            {attachments.length < MAX_ATTACHMENTS && (
              <PhotoUploadButton purpose="BROADCAST_ATTACHMENT" accept="image/*,application/pdf" size="sm" label="Add attachment"
                onLoaded={(url, filename) => setAttachments((list) => [...list, { url, filename }])} onError={setError} />
            )}
          </div>
        </div>
      )}

      {/* ---------- Preview ---------- */}
      {isEmail && (
        <div className="rounded-md border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">
              Preview {previewLoading && <Spinner className="ml-1 inline h-3 w-3" />}
            </p>
            <div className="flex overflow-hidden rounded-md border border-gray-300 text-xs">
              <button type="button" onClick={() => setDevice('desktop')}
                className={`px-2.5 py-1 ${device === 'desktop' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}>Desktop</button>
              <button type="button" onClick={() => setDevice('mobile')}
                className={`px-2.5 py-1 ${device === 'mobile' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}>Mobile</button>
            </div>
          </div>
          {previewError && <p className="mt-2 text-xs text-red-600">{previewError}</p>}
          {previewHtml ? (
            // sandbox="" = no scripts, no navigation: the preview can never run anything.
            <iframe title="Email preview" sandbox="" srcDoc={previewHtml}
              style={{ width: device === 'mobile' ? 375 : '100%', height: 560, border: 0 }}
              className="mx-auto mt-3 block max-w-full rounded-md border border-gray-200 bg-white" />
          ) : (
            !previewError && <p className="mt-3 text-xs text-gray-400">Start writing to see how the email will look.</p>
          )}
          {attachments.length > 0 && (
            <p className="mt-2 text-[11px] text-gray-400">Attached: {attachments.map((a) => a.filename).join(', ')}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      {anySending && <p className="text-xs text-amber-600">Another broadcast is still sending - you can send the next one when it finishes.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={!canSend}
          className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">
          {countsLoading && <Spinner className="h-4 w-4" />}
          Review &amp; send
        </button>
        {isEmail && (
          <button type="button" onClick={sendTest} disabled={testSending}
            className="flex items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            {testSending && <Spinner className="h-4 w-4" />}
            {testSending ? 'Sending test...' : 'Send test to me'}
          </button>
        )}
      </div>
      <ConfirmDialog {...dialogProps} />
    </form>
  )
}