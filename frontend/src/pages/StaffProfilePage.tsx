import { FormEvent, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import PhotoUploadButton from '../components/PhotoUploadButton'
import ChangePasswordSection from '../components/ChangePasswordSection'
import type { Profile, AttendanceLogEntry } from '../types'

const PAGE_SIZE = 5

type Tab = 'PROFILE' | 'ATTENDANCE'

export default function StaffProfilePage() {
    const user = useAuthStore((s) => s.user)
    const [activeTab, setActiveTab] = useState<Tab>('PROFILE')

    const [profile, setProfile] = useState<Profile | null>(null)
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [photo, setPhoto] = useState<string | null>(null)
    const [signature, setSignature] = useState<string | null>(null)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const [attendance, setAttendance] = useState<AttendanceLogEntry[]>([])
    const [attendanceError, setAttendanceError] = useState('')
    const [attendancePage, setAttendancePage] = useState(1)
    const [attendanceLoaded, setAttendanceLoaded] = useState(false)

    function load() {
        api.get<Profile>('/api/profile/me').then((res) => {
            setProfile(res.data)
            setName(res.data.name)
            setPhone(res.data.phone ?? '')
            setAddress(res.data.address ?? '')
            setPhoto(res.data.photo)
            setSignature(res.data.signature)
        })
    }

    function loadAttendance() {
        api.get<AttendanceLogEntry[]>('/api/attendance/mine')
            .then((res) => setAttendance(res.data))
            .catch((err) => setAttendanceError(err.response?.data?.error || 'Failed to load your attendance log'))
            .finally(() => setAttendanceLoaded(true))
    }

    useEffect(() => { load() }, [])

    // Attendance log is only fetched once the tab is actually opened, rather than
    // eagerly on mount alongside the profile - it's not needed until the person
    // switches over, and this keeps the initial page load to just what's visible.
    useEffect(() => {
        if (activeTab === 'ATTENDANCE' && !attendanceLoaded) {
            loadAttendance()
        }
    }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setAttendancePage(1)
    }, [attendance.length])

    async function handleSubmit(e: FormEvent) {
        e.preventDefault()
        setMessage(''); setError('')
        try {
            const { data } = await api.put<Profile>('/api/profile/me', { name, phone, address, photo, signature })
            setProfile(data)
            setMessage('Profile updated.')
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update profile')
        }
    }

    if (!profile) return null

    const attendanceTotalPages = Math.max(1, Math.ceil(attendance.length / PAGE_SIZE))
    const pagedAttendance = attendance.slice((attendancePage - 1) * PAGE_SIZE, attendancePage * PAGE_SIZE)

    const TABS: { key: Tab; label: string }[] = [
        { key: 'PROFILE', label: 'Profile' },
        { key: 'ATTENDANCE', label: 'Attendance' },
    ]

    return (
        <div className="mx-auto max-w-md px-4 py-10">
            <h1 className="text-2xl font-semibold">Your profile</h1>

            <div className="mt-6 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-gray-200">
                <div className="flex min-w-max gap-1">
                    {TABS.map((tab) => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm ${
                                activeTab === tab.key ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'PROFILE' && (
                <div className="mt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex flex-col items-center gap-3">
                            {photo ? (
                                <img src={photo} alt="Profile" className="h-24 w-24 flex-shrink-0 rounded-full object-cover" />
                            ) : (
                                <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-2xl font-medium text-gray-500">
                                    {profile.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <PhotoUploadButton onLoaded={setPhoto} onError={setError} label="Upload photo" />
                            {photo && (
                                <button type="button" onClick={() => setPhoto(null)} className="text-xs text-red-600 hover:underline">
                                    Remove photo
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Full name</label>
                            <input required value={name} onChange={(e) => setName(e.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input disabled value={profile.email}
                                className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <input value={phone} onChange={(e) => setPhone(e.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Address</label>
                            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Signature</label>
                            <p className="mt-0.5 text-xs text-gray-400">Stamped onto invoices for payments you record.</p>
                            <div className="mt-2 flex flex-col items-start gap-2">
                                {signature ? (
                                    <img src={signature} alt="Signature" className="h-16 rounded border border-gray-200 bg-white object-contain px-2" />
                                ) : (
                                    <div className="flex h-16 w-40 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-400">
                                        No signature yet
                                    </div>
                                )}
                                <PhotoUploadButton onLoaded={setSignature} onError={setError} label="Upload signature" size="sm" />
                                {signature && (
                                    <button type="button" onClick={() => setSignature(null)} className="text-xs text-red-600 hover:underline">
                                        Remove signature
                                    </button>
                                )}
                            </div>
                        </div>

                        {error && <p className="text-sm text-red-600">{error}</p>}
                        {message && <p className="text-sm text-green-700">{message}</p>}

                        <button type="submit" className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
                            Save changes
                        </button>
                    </form>

                    <ChangePasswordSection />
                </div>
            )}

            {activeTab === 'ATTENDANCE' && (
                <div className="mt-6 space-y-8">
                    {user && (
                        <div className="rounded-lg border border-gray-200 p-6 text-center">
                            <h2 className="font-medium">Your check-in code</h2>
                            <p className="mt-1 text-xs text-gray-500">Scan this at the gym, or use your 4-digit PIN at reception.</p>
                            <div className="mt-4 flex justify-center">
                                <QRCodeSVG value={user.userId} size={160} />
                            </div>
                        </div>
                    )}

                    <div className="rounded-lg border border-gray-200 p-6">
                        <h2 className="font-medium">Your attendance log</h2>
                        <p className="mt-1 text-xs text-gray-500">Second scan of the day at the same branch records check-out.</p>
                        {attendanceError && <p className="mt-2 text-sm text-red-600">{attendanceError}</p>}
                        <ul className="mt-4 divide-y divide-gray-100 text-sm">
                            {pagedAttendance.map((a) => (
                                <li key={a.id} className="py-2">
                                    <div className="flex items-center justify-between">
                                        <span>Check-in: {new Date(a.checkInTime).toLocaleString()}</span>
                                        <span className="text-right text-gray-500">
                                            {a.branchName}
                                            <span className="ml-2 text-xs text-gray-400">{a.method}</span>
                                        </span>
                                    </div>
                                    <div className="mt-0.5 text-xs text-gray-400">
                                        {a.checkOutTime
                                            ? `Check-out: ${new Date(a.checkOutTime).toLocaleString()}`
                                            : 'Not checked out yet'}
                                    </div>
                                </li>
                            ))}
                            {attendanceLoaded && attendance.length === 0 && (
                                <li className="py-2 text-gray-400">No visits logged yet.</li>
                            )}
                        </ul>
                        {attendance.length > 0 && (
                            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                <span>Page {attendancePage} of {attendanceTotalPages} ({attendance.length} total)</span>
                                <div className="space-x-2">
                                    <button disabled={attendancePage === 1} onClick={() => setAttendancePage((p) => p - 1)}
                                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                                    <button disabled={attendancePage === attendanceTotalPages} onClick={() => setAttendancePage((p) => p + 1)}
                                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}