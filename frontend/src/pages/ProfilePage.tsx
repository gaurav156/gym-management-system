import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import PhotoUploadButton from '../components/PhotoUploadButton'
import ChangePasswordSection from '../components/ChangePasswordSection'
import PersonalDetailsFields from '../components/PersonalDetailsFields'
import IdProofField from '../components/IdProofField'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'
import Avatar from '../components/Avatar'
import { useConfirm } from '../hooks/useConfirm'
import type { Gender, Profile } from '../types'
import MarketingPreferenceSection from '../components/MarketingPreferenceSection'

const norm = (s: string | null | undefined) => (s ?? '').trim()

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [gender, setGender] = useState<Gender | ''>('')
  const [dob, setDob] = useState('')
  const [idProofPending, setIdProofPending] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { confirm, dialogProps } = useConfirm()

  function applyProfile(p: Profile) {
    setProfile(p)
    setName(p.name)
    setPhone(p.phone ?? '')
    setAddress(p.address ?? '')
    setPhoto(p.photo)
    setGender(p.gender ?? '')
    setDob(p.dateOfBirth ?? '')
    setIdProofPending(null)
  }

  useEffect(() => { api.get<Profile>('/api/profile/me').then((res) => applyProfile(res.data)) }, [])

  function detailsChanged(): boolean {
    if (!profile) return false
    return norm(name) !== norm(profile.name) || norm(phone) !== norm(profile.phone)
      || norm(address) !== norm(profile.address) || (photo ?? '') !== (profile.photo ?? '')
      || gender !== (profile.gender ?? '') || dob !== (profile.dateOfBirth ?? '')
  }

  async function save() {
    setMessage(''); setError('')
    setSaving(true)
    try {
      const { data } = await api.put<Profile>('/api/profile/me', {
        name, phone, address, photo: photo ?? '',
        gender: gender || undefined,
        dateOfBirth: dob || undefined,
        idProof: idProofPending ?? undefined,
      })
      applyProfile(data)
      setMessage('Profile updated.')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving || !profile) return
    // The first save that changes anything uses up the one self-service edit - make that explicit.
    if (!profile.detailsLocked && detailsChanged()) {
      confirm({
        title: 'Save your details?',
        message: 'You can update your details (including your photo) only once. After this, only the Owner or a Manager can change them for you. Make sure everything is correct.',
        confirmLabel: 'Save',
        onConfirm: save,
      })
    } else {
      save()
    }
  }

  if (!profile) return null
  const locked = profile.detailsLocked
  const inputClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none disabled:bg-gray-50 disabled:text-gray-500'

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Your profile</h1>

      {locked ? (
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
          You've already used your one-time update. To change your details, please ask the Owner or a Manager.
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">You can update your details only once - after that, the Owner or a Manager makes changes for you.</p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="flex flex-col items-center gap-3">
          <Avatar src={photo} name={profile.name} className="h-24 w-24" textClassName="text-2xl" />
          {!locked && (
            <>
              <PhotoUploadButton onLoaded={setPhoto} onError={setError} label="Upload photo" />
              {photo && (
                <button type="button" onClick={() => setPhoto(null)} className="text-xs text-red-600 hover:underline">
                  Remove photo
                </button>
              )}
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Full name</label>
          <input required disabled={locked} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input disabled value={profile.email}
            className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input disabled={locked} value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address</label>
          <textarea disabled={locked} value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={inputClass} />
        </div>

        <PersonalDetailsFields gender={gender} dateOfBirth={dob} disabled={locked}
          onGenderChange={setGender} onDateOfBirthChange={setDob} />

        <IdProofField personId={profile.id} uploaded={profile.idProofUploaded} pendingKey={idProofPending}
          canChange={!profile.idProofUploaded} onUploaded={setIdProofPending} onError={setError} />
        {profile.idProofUploaded && (
          <p className="-mt-2 text-xs text-gray-400">Once submitted, your ID proof can only be changed by the Owner or a Manager.</p>
        )}

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

        {(!locked || idProofPending) && (
          <button type="submit" disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
            {saving && <Spinner className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        )}
      </form>

      <MarketingPreferenceSection initial={profile.marketingConsent} />
      <ChangePasswordSection />
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}