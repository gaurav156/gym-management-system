import type { Gender } from '../types'
import { calculateAge } from '../utils/person'
import { localDateISO } from '../utils/date'

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
]

interface Props {
  gender: Gender | ''
  dateOfBirth: string
  onGenderChange: (g: Gender | '') => void
  onDateOfBirthChange: (v: string) => void
  disabled?: boolean
  compact?: boolean // smaller styling for the staff modals
}

export default function PersonalDetailsFields({ gender, dateOfBirth, onGenderChange, onDateOfBirthChange, disabled, compact }: Props) {
  const label = compact ? 'text-xs text-gray-500' : 'block text-sm font-medium text-gray-700'
  const input = compact
    ? 'mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50'
    : 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none disabled:bg-gray-50 disabled:text-gray-500'
  const age = dateOfBirth ? calculateAge(dateOfBirth) : null

  return (
    <>
      <div>
        <label className={label}>Gender</label>
        <select value={gender} disabled={disabled} onChange={(e) => onGenderChange(e.target.value as Gender | '')} className={input}>
          <option value="">Select...</option>
          {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Date of birth</label>
        <input type="date" value={dateOfBirth} max={localDateISO()} disabled={disabled}
          onChange={(e) => onDateOfBirthChange(e.target.value)} className={input} />
        {age != null && <p className="mt-1 text-xs text-gray-500">Age: {age} year{age === 1 ? '' : 's'}</p>}
      </div>
    </>
  )
}