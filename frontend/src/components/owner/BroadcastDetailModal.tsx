import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { TableSkeleton } from '../Skeleton'
import { audienceLabel, CHANNEL_LABELS, TYPE_LABELS } from './broadcastConstants'
import type { Broadcast, BroadcastRecipient, PageResponse } from '../../types'
import { useScrollLock } from '../../hooks/useScrollLock'

const PAGE_SIZE = 8

interface Props {
  broadcast: Broadcast
  onClose: () => void
}

export default function BroadcastDetailModal({ broadcast, onClose }: Props) {
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [failedOnly, setFailedOnly] = useState(false)

  function load(p = 0, only = failedOnly) {
    setLoading(true)
    api.get<PageResponse<BroadcastRecipient>>(`/api/owner/broadcasts/${broadcast.id}/recipients`, {
      params: { status: only ? 'FAILED' : undefined, page: p, size: PAGE_SIZE },
    }).then((res) => {
      setRecipients(res.data.content)
      setTotalPages(res.data.totalPages)
      setTotalElements(res.data.totalElements)
      setPage(res.data.page)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load(0, failedOnly) }, [failedOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  useScrollLock()

  const pending = broadcast.totalRecipients - broadcast.sentCount - broadcast.failedCount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-lg bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="break-words text-lg font-medium">{broadcast.subject ?? `${CHANNEL_LABELS[broadcast.channel]} broadcast`}</h3>
            <p className="text-xs text-gray-500">
              {CHANNEL_LABELS[broadcast.channel]} · {TYPE_LABELS[broadcast.type]} · {audienceLabel(broadcast.audience)} · by {broadcast.createdByName} ·{' '}
              {new Date(broadcast.createdAt).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <p className="mt-4 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-700">{broadcast.body}</p>

        <p className="mt-4 text-sm text-gray-600">
          <span className="text-green-700">{broadcast.sentCount} sent</span>
          {' · '}<span className={broadcast.failedCount > 0 ? 'text-red-600' : ''}>{broadcast.failedCount} failed</span>
          {pending > 0 && <> · {pending} pending</>}
          {broadcast.skippedCount > 0 && <> · {broadcast.skippedCount} skipped (no contact on file)</>}
          {broadcast.optedOutCount > 0 && <> · {broadcast.optedOutCount} opted out</>}
        </p>

        {broadcast.attachmentNames.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">Attachments: {broadcast.attachmentNames.join(', ')}</p>
        )}

        <label className="mt-4 flex items-center gap-1.5 text-xs text-gray-500">
          <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} />
          Show failed only
        </label>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Recipient</th>
                <th className="pb-2 pr-4">{broadcast.channel === 'EMAIL' ? 'Email' : 'Phone'}</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <TableSkeleton rows={4} columns={3} /> : recipients.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-4">{r.recipientName}</td>
                  <td className="py-2 pr-4 text-gray-500">{r.destination}</td>
                  <td className="py-2">
                    <span className={r.status === 'SENT' ? 'text-green-700' : r.status === 'FAILED' ? 'text-red-600' : 'text-gray-400'}>
                      {r.status === 'SENT' ? 'Sent' : r.status === 'FAILED' ? 'Failed' : 'Pending'}
                    </span>
                    {r.errorMessage && <p className="max-w-[260px] truncate text-[11px] text-red-500" title={r.errorMessage}>{r.errorMessage}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && recipients.length === 0 && <p className="py-4 text-sm text-gray-400">No recipients to show.</p>}
        {totalElements > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Page {page + 1} of {totalPages} ({totalElements} total)</span>
            <div className="space-x-2">
              <button disabled={page === 0} onClick={() => load(page - 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
              <button disabled={page + 1 >= totalPages} onClick={() => load(page + 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}