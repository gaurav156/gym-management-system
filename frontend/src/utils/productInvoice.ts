import jsPDF from 'jspdf'
import type { ProductOrderInvoice } from '../types'

const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'Gym Invoice'
const GYM_LOGO_URL = import.meta.env.VITE_GYM_LOGO_URL || ''
const DIRECTOR_NAME = (import.meta.env.VITE_DIRECTOR_NAME || '').trim()

// Kept separate from utils/invoice.ts - the doc-building differs enough (item table vs.
// one plan line) that sharing a single buildDoc would need a lot of branching.
let logoDataUrlCache: string | null | undefined

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
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, size, size)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

async function fetchAsDataUrl(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, init)
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
    logoDataUrlCache = null
  }
  return logoDataUrlCache
}

function dataUrlFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
}

async function buildInvoiceDoc(inv: ProductOrderInvoice): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = 50

  const logo = await getLogoDataUrl()
  const headerTextX = logo ? margin + 46 : margin
  if (logo) { try { doc.addImage(logo, dataUrlFormat(logo), margin, y - 26, 36, 36) } catch { /* skip */ } }

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(GYM_NAME, headerTextX, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('ORDER INVOICE', pageWidth - margin, y, { align: 'right' })

  let leftY = y + 16, rightY = y + 16
  doc.text(inv.branchName, headerTextX, leftY)
  doc.text(`Invoice #: ${inv.invoiceNumber}`, pageWidth - margin, rightY, { align: 'right' })
  leftY += 14; rightY += 14
  doc.text(`Date: ${new Date(inv.invoiceDate).toLocaleDateString()}`, pageWidth - margin, rightY, { align: 'right' })
  rightY += 14
  if (inv.branchAddress) {
    const wrapped = doc.splitTextToSize(inv.branchAddress, pageWidth - margin - headerTextX - 170)
    doc.text(wrapped, headerTextX, leftY); leftY += 14 * wrapped.length
  }
  if (inv.branchPhone) { doc.text(`Ph: ${inv.branchPhone}`, headerTextX, leftY); leftY += 14 }

  y = Math.max(leftY, rightY) + 10
  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  doc.setFont('helvetica', 'bold')
  doc.text('Billed To', margin, y); y += 16
  doc.setFont('helvetica', 'normal')
  doc.text(inv.memberName, margin, y); y += 14
  if (inv.memberPhone) { doc.text(inv.memberPhone, margin, y); y += 14 }
  doc.text(inv.memberEmail, margin, y); y += 14
  if (inv.memberAddress) {
    const wrapped = doc.splitTextToSize(inv.memberAddress, pageWidth - margin * 2)
    doc.text(wrapped, margin, y); y += 14 * wrapped.length
  }

  y += 16
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  const col1 = margin, col2 = margin + 260, col3 = margin + 360, col4 = pageWidth - margin
  doc.setFont('helvetica', 'bold')
  doc.text('Item', col1, y); doc.text('Qty', col2, y); doc.text('Unit', col3, y)
  doc.text('Line total', col4, y, { align: 'right' })
  y += 8
  doc.line(margin, y, pageWidth - margin, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  for (const item of inv.items) {
    const nameLines = doc.splitTextToSize(item.productName, col2 - col1 - 10)
    doc.text(nameLines, col1, y)
    doc.text(String(item.quantity), col2, y)
    doc.text(`Rs. ${item.unitPrice.toFixed(2)}`, col3, y)
    doc.text(`Rs. ${item.lineTotal.toFixed(2)}`, col4, y, { align: 'right' })
    y += 16 * nameLines.length
  }
  y += 8
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  doc.text(`Subtotal: Rs. ${inv.subtotal.toFixed(2)}`, col4, y, { align: 'right' }); y += 14
  if (inv.discountAmount > 0) {
    doc.text(`Discount${inv.couponCode ? ` (${inv.couponCode})` : ''}: -Rs. ${inv.discountAmount.toFixed(2)}`, col4, y, { align: 'right' })
    y += 14
  }
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Paid: Rs. ${inv.totalAmount.toFixed(2)}`, col4, y, { align: 'right' }); y += 14
  doc.setFont('helvetica', 'normal')
  doc.text(`Mode: ${inv.mode.replace('_', ' ')}`, col4, y, { align: 'right' })
  y += 36

  const sigX = pageWidth - margin - 120
  let signature: string | null = null
  if (inv.recordedBySignature) {
    try {
      signature = inv.recordedBySignature.startsWith('data:')
        ? inv.recordedBySignature
        : await fetchAsDataUrl(inv.recordedBySignature, { mode: 'cors', cache: 'no-store' })
    } catch { signature = null }
  }
  if (signature) { try { doc.addImage(signature, dataUrlFormat(signature), sigX, y - 34, 120, 40) } catch { /* skip */ } }
  y += 10
  doc.setDrawColor(180)
  doc.line(sigX, y, sigX + 120, y)
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Authorized Signatory', sigX, y); y += 12
  if (inv.recordedByName) doc.text(inv.recordedByName, sigX, y)

  if (DIRECTOR_NAME) {
    y += 30
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Director', margin, y); y += 14
    doc.setFont('helvetica', 'normal')
    doc.text(DIRECTOR_NAME, margin, y)
  }

  return doc
}

export async function viewProductInvoice(inv: ProductOrderInvoice) {
  const doc = await buildInvoiceDoc(inv)
  window.open(doc.output('bloburl') as unknown as string, '_blank')
}

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export async function printProductInvoice(inv: ProductOrderInvoice) {
  const doc = await buildInvoiceDoc(inv)
  const blob = doc.output('blob')
  const blobUrl = URL.createObjectURL(blob)
  if (isMobileDevice()) { window.open(blobUrl, '_blank'); return }
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'
  iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0'
  iframe.src = blobUrl
  document.body.appendChild(iframe)
  iframe.onload = () => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch { window.open(blobUrl, '_blank') }
    setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(blobUrl) }, 60_000)
  }
}

export async function downloadProductInvoice(inv: ProductOrderInvoice) {
  const doc = await buildInvoiceDoc(inv)
  doc.save(`order-${inv.invoiceNumber}.pdf`)
}