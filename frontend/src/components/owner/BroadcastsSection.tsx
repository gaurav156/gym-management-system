import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { TableSkeleton } from '../Skeleton'
import BroadcastComposer from './BroadcastComposer'
import BroadcastDetailModal from './BroadcastDetailModal'
import { CHANNEL_LABELS, TYPE_LABELS, audienceLabel } from './broadcastConstants'
import type { Broadcast, PageResponse } from '../../types'

const PAGE_SIZE = 5
const POLL_MS = 3000

export default function BroadcastsSection() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [viewing, setViewing] = useState<Broadcast | null>(null)
  const pageRef = useRef(0)

  function load(p = 0, silent = false) {
    if (!silent) setLoading(true)
    api.get<PageResponse<Broadcast>>('/api/owner/broadcasts', { params: { page: p, size: PAGE_SIZE } })
      .then((res) => {
        setBroadcasts(res.data.content)
        setTotalPages(res.data.totalPages)
        setTotalElements(res.data.totalElements)
        setPage(res.data.page)
        pageRef.current = res.data.page
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(0) }, [])

  // While anything is still sending, refresh so progress counts tick up.
  const anySending = broadcasts.some((b) => b.status === 'SENDING')
  useEffect(() => {
    if (!anySending) return
    const handle = setInterval(() => load(pageRef.current, true), POLL_MS)
    return () => clearInterval(handle)
  }, [anySending])

  function statusBadge(b: Broadcast) {
    const cls = b.status === 'COMPLETED' ? 'text-green-700' : b.status === 'FAILED' ? 'text-red-600' : 'text-blue-600'
    const label = b.status === 'SENDING' ? 'Sending...' : b.status === 'COMPLETED' ? 'Completed' : 'Failed'
    return <span className={cls}>{label}</span>
  }

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <h2 className="font-medium">Broadcast messages</h2>
      <p className="mt-1 text-xs text-gray-500">
        Send announcements, important updates or promotions to a group of people. Only the Owner can do this.
      </p>

      <BroadcastComposer anySending={anySending} onSent={() => load(0)} />

      <h3 className="mt-8 text-sm font-medium">History</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-2 pr-4">Sent</th>
              <th className="pb-2 pr-4">Channel</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Audience</th>
              <th className="pb-2 pr-4">Message</th>
              <th className="pb-2 pr-4">Delivered</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <TableSkeleton rows={4} columns={8} /> : broadcasts.map((b) => (
              <tr key={b.id}>
                <td className="py-2 pr-4 text-gray-500">{new Date(b.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-4">{CHANNEL_LABELS[b.channel]}</td>
                <td className="py-2 pr-4 text-gray-500">{TYPE_LABELS[b.type]}</td>
                <td className="py-2 pr-4 text-gray-500">{audienceLabel(b.audience)}</td>
                <td className="max-w-[200px] truncate py-2 pr-4 text-gray-500" title={b.subject ?? b.body}>
                  {b.subject ?? b.body}
                </td>
                <td className="py-2 pr-4">
                  {b.sentCount} / {b.totalRecipients}
                  {b.failedCount > 0 && <span className="ml-1 text-xs text-red-600">({b.failedCount} failed)</span>}
                </td>
                <td className="py-2 pr-4">{statusBadge(b)}</td>
                <td className="py-2">
                  <button type="button" onClick={() => setViewing(b)} className="text-xs text-brand hover:underline">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && broadcasts.length === 0 && <p className="py-4 text-sm text-gray-400">No broadcasts sent yet.</p>}
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

      {viewing && (
        <BroadcastDetailModal
          broadcast={broadcasts.find((b) => b.id === viewing.id) ?? viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}