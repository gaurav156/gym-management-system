import { useState } from 'react'
import { api } from '../../api/client'
import Spinner from '../Spinner'
import ConfirmDialog from '../ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'

type Preset = 'ALL' | 'LAST_6_MONTHS' | 'LAST_12_MONTHS' | 'CUSTOM'
type ImportMode = 'MERGE' | 'REPLACE'

interface ImportResult {
  mode: string
  backupCreatedAt: string | null
  preset: string | null
  tables: { table: string; read: number; inserted: number }[]
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'ALL', label: 'Complete' },
  { value: 'LAST_6_MONTHS', label: 'Last 6 months' },
  { value: 'LAST_12_MONTHS', label: 'Last 1 year' },
  { value: 'CUSTOM', label: 'Custom range' },
]

// Blob responses hide the JSON error body - read it back out.
async function blobError(err: any, fallback: string): Promise<string> {
  try {
    const text = await err.response.data.text()
    return JSON.parse(text).error || fallback
  } catch {
    return err.response?.data?.error || fallback
  }
}

export default function BackupSection() {
  const [preset, setPreset] = useState<Preset>('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState<'backup' | 'excel' | 'import' | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<ImportMode>('MERGE')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const { confirm, dialogProps } = useConfirm()

  function rangeParams() {
    const p: Record<string, string> = { preset }
    if (preset === 'CUSTOM') { p.from = from; p.to = to }
    return p
  }

  function rangeValid(): boolean {
    if (preset === 'CUSTOM' && (!from || !to)) { setError('Select both a start and an end date.'); return false }
    return true
  }

  async function download(kind: 'backup' | 'excel') {
    setError(''); setMessage('')
    if (!rangeValid()) return
    setBusy(kind)
    try {
      const path = kind === 'backup' ? '/api/owner/backup/export' : '/api/owner/backup/excel'
      const res = await api.get(path, { params: rangeParams(), responseType: 'blob' })
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
      const name = kind === 'backup'
        ? `gym-backup-${preset.toLowerCase()}-${stamp}.zip`
        : `gym-data-${preset.toLowerCase()}-${stamp}.xlsx`
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = name
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMessage(kind === 'backup' ? 'Backup downloaded.' : 'Excel file downloaded.')
    } catch (err: any) {
      setError(await blobError(err, 'Download failed'))
    } finally {
      setBusy(null)
    }
  }

  async function runImport() {
    if (!file) return
    setError(''); setMessage(''); setResult(null)
    setBusy('import')
    try {
      // A File is a Blob, so the browser streams it from disk - it is never read into memory.
      const { data } = await api.post<ImportResult>('/api/owner/backup/import', file, {
        params: { mode },
        headers: { 'Content-Type': 'application/octet-stream', 'X-Backup-Password': password },
        timeout: 0, maxBodyLength: Infinity, maxContentLength: Infinity,
      })
      setResult(data)
      setMessage('Import completed.')
      setPassword('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed - nothing was changed.')
    } finally {
      setBusy(null)
    }
  }

  function handleImport() {
    setError(''); setMessage('')
    if (!file) { setError('Choose a backup (.zip) file first.'); return }
    if (!password) { setError('Enter your password to confirm.'); return }
    confirm({
      title: mode === 'REPLACE' ? 'Replace ALL data?' : 'Import backup?',
      message: mode === 'REPLACE'
        ? 'This permanently deletes everything currently in this database and loads the backup instead. If the backup is from another database you will be signed out and need to log in with that database\'s accounts. This cannot be undone.'
        : 'Rows that already exist are skipped; missing rows are added. Nothing is deleted.',
      confirmLabel: mode === 'REPLACE' ? 'Replace everything' : 'Import',
      danger: mode === 'REPLACE',
      onConfirm: runImport,
    })
  }

  const input = 'mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm'

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <h2 className="font-medium">Backup, restore &amp; Excel export</h2>
      <p className="mt-1 text-xs text-gray-500">
        Backups include accounts (password hashes) and personal data - store them securely. Uploaded images and ID proofs
        live in object storage and are not inside the file.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500">Data range</label>
          <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className={input}>
            {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {preset === 'CUSTOM' && (
          <>
            <div>
              <label className="block text-xs text-gray-500">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-xs text-gray-500">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
            </div>
          </>
        )}
        <button onClick={() => download('backup')} disabled={busy !== null}
          className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
          {busy === 'backup' && <Spinner className="h-4 w-4" />}
          {busy === 'backup' ? 'Preparing...' : 'Download backup (.zip)'}
        </button>
        <button onClick={() => download('excel')} disabled={busy !== null}
          className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70">
          {busy === 'excel' && <Spinner className="h-4 w-4" />}
          {busy === 'excel' ? 'Preparing...' : 'Download Excel'}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Transactions (payments, memberships, orders, expenses, attendance) follow the range; people, branches, plans and products are always included in full.
      </p>

      <hr className="my-6" />

      <h3 className="text-sm font-medium">Restore from a backup</h3>
      <p className="mt-1 text-xs text-gray-500">
        Moving to a new database? Start the app against it once so the tables are created, then use <em>Replace</em>.
        Both sides must run the same app version.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500">Backup file</label>
          <input type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as ImportMode)} className={input}>
            <option value="MERGE">Merge - add missing rows, delete nothing</option>
            <option value="REPLACE">Replace - wipe this database first</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Your password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        </div>
        <button onClick={handleImport} disabled={busy !== null}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70 ${
            mode === 'REPLACE' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-900'
          }`}>
          {busy === 'import' && <Spinner className="h-4 w-4" />}
          {busy === 'import' ? 'Importing...' : 'Import'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

      {result && (
        <div className="mt-3 overflow-x-auto">
          <p className="text-xs text-gray-500">
            Backup taken {result.backupCreatedAt ? new Date(result.backupCreatedAt).toLocaleString() : '-'} · range {result.preset}
          </p>
          <table className="mt-2 w-full max-w-md text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-1 pr-4">Table</th><th className="pb-1 pr-4">In file</th><th className="pb-1">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.tables.map((t) => (
                <tr key={t.table}><td className="py-1 pr-4">{t.table}</td><td className="py-1 pr-4">{t.read}</td><td className="py-1">{t.inserted}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}