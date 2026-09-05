import jsPDF from 'jspdf'
import type { InvoiceResponse } from '../types'

const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'Gym Invoice'
const GYM_LOGO_URL = import.meta.env.VITE_GYM_LOGO_URL || ''
const DIRECTOR_NAME = (import.meta.env.VITE_DIRECTOR_NAME || '').trim()

const DEFAULT_TERMS = [
  'Fees must be paid before 10th of every months.',
  'The membership will be cancelled if the dues are not paid by the member for two months.',
  "Regarding all members the Director's decision will be final.",
  'Fees once paid will not be refund, not transferable & not extendable.',
]

// Env value is "|"-delimited (a .env value can't hold real newlines). Each segment
// becomes one numbered term. Falls back to DEFAULT_TERMS if unset or blank.
function getTermsLines(): string[] {
  const raw = import.meta.env.VITE_INVOICE_TERMS
  if (!raw || !raw.trim()) return DEFAULT_TERMS
  return raw.split('|').map((t) => t.trim()).filter(Boolean)
}

let logoDataUrlCache: string | null | undefined // undefined = not yet attempted

async function svgUrlToPngDataUrl(url: string, size = 240): Promise<string> {
  const res = await fetch(url)
  const svgText = await res.text()
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(svgBlob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, size, size)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function getLogoDataUrl(): Promise<string | null> {
  if (!GYM_LOGO_URL) return null
  if (logoDataUrlCache !== undefined) return logoDataUrlCache
  try {
    logoDataUrlCache = GYM_LOGO_URL.toLowerCase().endsWith('.svg')
      ? await svgUrlToPngDataUrl(GYM_LOGO_URL)
      : await fetchAsDataUrl(GYM_LOGO_URL)
  } catch {
    logoDataUrlCache = null // fail quietly - invoice still renders without a logo
  }
  return logoDataUrlCache
}

function dataUrlFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
}

async function buildInvoiceDoc(inv: InvoiceResponse): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = 50

  const logo = await getLogoDataUrl()
  const headerTextX = logo ? margin + 46 : margin
  if (logo) {
    try { doc.addImage(logo, dataUrlFormat(logo), margin, y - 26, 36, 36) } catch { /* skip if malformed */ }
  }

  // Reserve a right-hand column for invoice#/date so the left column (branch name,
  // wrapped address, phone) never collides with it, no matter how many lines the
  // address wraps to.
  const rightColWidth = 170
  const leftColMaxWidth = pageWidth - margin - headerTextX - rightColWidth - 10

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(GYM_NAME, headerTextX, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('INVOICE', pageWidth - margin, y, { align: 'right' })

  let leftY = y + 16
  let rightY = y + 16

  doc.text(inv.branchName, headerTextX, leftY)
  doc.text(`Invoice #: ${inv.invoiceNumber}`, pageWidth - margin, rightY, { align: 'right' })
  leftY += 14
  rightY += 14

  doc.text(`Date: ${new Date(inv.invoiceDate).toLocaleDateString()}`, pageWidth - margin, rightY, { align: 'right' })
  rightY += 14

  if (inv.branchAddress) {
    const wrapped = doc.splitTextToSize(inv.branchAddress, leftColMaxWidth)
    doc.text(wrapped, headerTextX, leftY)
    leftY += 14 * wrapped.length
  }

  if (inv.branchPhone) {
    doc.text(`Ph: ${inv.branchPhone}`, headerTextX, leftY)
    leftY += 14
  }

  y = Math.max(leftY, rightY) + 10

  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  doc.setFont('helvetica', 'bold')
  doc.text('Billed To', margin, y)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.text(inv.memberName, margin, y)
  y += 14
  if (inv.memberPhone) { doc.text(inv.memberPhone, margin, y); y += 14 }
  doc.text(inv.memberEmail, margin, y)
  y += 14
  if (inv.memberAddress) {
    const wrapped = doc.splitTextToSize(inv.memberAddress, pageWidth - margin * 2)
    doc.text(wrapped, margin, y)
    y += 14 * wrapped.length
  }

  y += 16
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  const col1 = margin, col2 = margin + 260, col3 = margin + 380, col4 = pageWidth - margin

  doc.setFont('helvetica', 'bold')
  doc.text('Description', col1, y)
  doc.text('Period', col2, y)
  doc.text('Mode', col3, y)
  doc.text('Amount', col4, y, { align: 'right' })
  y += 8
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  const period = inv.membershipStartDate && inv.membershipEndDate
    ? `${inv.membershipStartDate} to ${inv.membershipEndDate}`
    : '—'

  doc.setFont('helvetica', 'normal')
  doc.text(inv.planName || 'Membership payment', col1, y)
  doc.text(period, col2, y)
  doc.text(inv.mode.replace('_', ' '), col3, y)
  doc.text(`Rs. ${inv.amount.toFixed(2)}`, col4, y, { align: 'right' })
  y += 20
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  doc.setFont('helvetica', 'bold')
  doc.text('Total Paid', col3, y)
  doc.text(`Rs. ${inv.amount.toFixed(2)}`, col4, y, { align: 'right' })
  y += 36

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Note: Fees once paid will not be refund, not transferable & not extendable.', margin, y)
  y += 30

  const sigX = pageWidth - margin - 120
  if (inv.recordedBySignature) {
    try { doc.addImage(inv.recordedBySignature, dataUrlFormat(inv.recordedBySignature), sigX, y - 34, 120, 40) } catch { /* skip */ }
  }
  y += 10
  doc.setDrawColor(180)
  doc.line(sigX, y, sigX + 120, y)
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Authorized Signatory', sigX, y)
  y += 12
  doc.text(inv.recordedByName, sigX, y)
  y += 30

  const termsLines = getTermsLines()
  const numberedTerms = termsLines.map((t, i) => `${i + 1}. ${t}`)

  // Rough height estimate for the overflow check, accounting for word-wrap
  const estimatedTermsHeight = numberedTerms.reduce((sum, line) => {
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2)
    return sum + 13 * wrapped.length
  }, 0)
  const directorBlockHeight = DIRECTOR_NAME ? 30 : 16

  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + 40 + estimatedTermsHeight + directorBlockHeight > pageHeight - margin) {
    doc.addPage()
    y = 50
  }

  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('TERMS', margin, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const line of numberedTerms) {
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2)
    doc.text(wrapped, margin, y)
    y += 13 * wrapped.length
  }

  // Director line only appears if configured - omitted entirely otherwise, rather than
  // showing an empty "Director" heading with no name under it.
  if (DIRECTOR_NAME) {
    y += 16
    doc.setFont('helvetica', 'bold')
    doc.text('Director', margin, y)
    y += 14
    doc.text(DIRECTOR_NAME, margin, y)
  }

  return doc
}

export async function viewInvoice(inv: InvoiceResponse) {
  const doc = await buildInvoiceDoc(inv)
  window.open(doc.output('bloburl') as unknown as string, '_blank')
}

export async function printInvoice(inv: InvoiceResponse) {
  const doc = await buildInvoiceDoc(inv)
  doc.autoPrint()
  window.open(doc.output('bloburl') as unknown as string, '_blank')
}

export async function downloadInvoice(inv: InvoiceResponse) {
  const doc = await buildInvoiceDoc(inv)
  doc.save(`invoice-${inv.invoiceNumber}.pdf`)
}