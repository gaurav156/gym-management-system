import jsPDF from 'jspdf'
import type { InvoiceResponse } from '../types'

function buildInvoiceDoc(inv: InvoiceResponse): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = 50

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Gym Invoice', margin, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('INVOICE', pageWidth - margin, y, { align: 'right' })

  y += 16
  doc.text(inv.branchName, margin, y)
  doc.text(`Invoice #: ${inv.invoiceNumber}`, pageWidth - margin, y, { align: 'right' })

  y += 14
  if (inv.branchAddress) doc.text(inv.branchAddress, margin, y)
  doc.text(`Date: ${new Date(inv.invoiceDate).toLocaleDateString()}`, pageWidth - margin, y, { align: 'right' })

  y += 14
  if (inv.branchPhone) doc.text(`Ph: ${inv.branchPhone}`, margin, y)

  y += 24
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
  if (inv.memberAddress) { doc.text(inv.memberAddress, margin, y); y += 14 }

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
  y += 40

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Recorded by: ${inv.recordedByName}`, margin, y)
  y += 14
  doc.text('This is a system-generated invoice.', margin, y)

  return doc
}

export function viewInvoice(inv: InvoiceResponse) {
  const doc = buildInvoiceDoc(inv)
  window.open(doc.output('bloburl') as unknown as string, '_blank')
}

export function printInvoice(inv: InvoiceResponse) {
  const doc = buildInvoiceDoc(inv)
  doc.autoPrint()
  window.open(doc.output('bloburl') as unknown as string, '_blank')
}

export function downloadInvoice(inv: InvoiceResponse) {
  const doc = buildInvoiceDoc(inv)
  doc.save(`invoice-${inv.invoiceNumber}.pdf`)
}