import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Profile } from '../types'

const MAX_PHOTO_BYTES = 1_500_000 // ~1.5MB - base64 in a DB column, keep it modest

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function load() {
    api.get<Profile>('/api/profile/me').then((res) => {
      setProfile(res.data)
      setName(res.data.name)
      setPhone(res.data.phone ?? '')
      setAddress(res.data.address ?? '')
      setPhoto(res.data.photo)
    })
  }

  useEffect(() => { load() }, [])

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const inputEl = e.target
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Photo is too large - please use one under ~1.5MB.')
      inputEl.value = ''
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file)
    inputEl.value = ''
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(''); setError('')
    try {
      const { data } = await api.put<Profile>('/api/profile/me', { name, phone, address, photo })
      setProfile(data)
      setMessage('Profile updated.')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile')
    }
  }

  if (!profile) return null

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Your profile</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="flex flex-col items-center gap-3">
          {photo ? (
            <img src={photo} alt="Profile" className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200 text-2xl font-medium text-gray-500">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-sm" />
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

        {profile.role === 'MEMBER' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Enrollment date</label>
            <input disabled value={profile.enrollmentDate ?? 'Not enrolled yet - purchase a plan'}
              className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500" />
          </div>
        )}
        {profile.role === 'TRAINER' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Joining date</label>
            <input disabled value={profile.joiningDate ?? '—'}
              className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500" />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button type="submit" className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
          Save changes
        </button>
      </form>
    </div>
  )
}