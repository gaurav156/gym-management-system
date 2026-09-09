import { useState } from 'react'
import type { HourlyCount } from '../types'

interface Props {
  data: HourlyCount[]
}

function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour} ${period}`
}

// Google Maps "popular times"-style occupancy chart: one bar per hour (0-23), the
// current hour highlighted by default, and tap/hover on any bar to see that hour's
// exact count. Occupancy (not raw check-in counts) comes from the backend, which
// counts a member as present in every hour their visit spans, not just the hour they
// scanned in during.
export default function HourlyCrowdChart({ data }: Props) {
  const currentHour = new Date().getHours()
  const [focusedHour, setFocusedHour] = useState<number | null>(null)

  const byHour = new Map(data.map((d) => [d.hour, d.count]))
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: byHour.get(h) ?? 0 }))
  const maxCount = Math.max(1, ...hours.map((h) => h.count))

  const activeHour = focusedHour ?? currentHour
  const activeCount = hours.find((h) => h.hour === activeHour)?.count ?? 0

  return (
    <div>
      <p className="text-xs text-gray-500">
        {focusedHour === null ? 'Right now' : formatHour(activeHour)} ·{' '}
        <span className="font-medium text-gray-700">
          {activeCount === 0 ? 'Not busy' : `${activeCount} member${activeCount === 1 ? '' : 's'} present`}
        </span>
      </p>

      <div className="mt-3 flex h-28 items-end gap-[3px]">
        {hours.map(({ hour, count }) => {
          const isCurrent = hour === currentHour
          const isFocused = hour === activeHour
          return (
            <button
              key={hour}
              type="button"
              onMouseEnter={() => setFocusedHour(hour)}
              onMouseLeave={() => setFocusedHour(null)}
              onClick={() => setFocusedHour((h) => (h === hour ? null : hour))}
              className="group flex h-full flex-1 flex-col items-center justify-end focus:outline-none"
              aria-label={`${formatHour(hour)}: ${count} member${count === 1 ? '' : 's'} present`}
            >
              <div
                className={`w-full rounded-t transition-colors ${
                  isFocused ? 'bg-brand-dark' : isCurrent ? 'bg-brand' : 'bg-brand/35 group-hover:bg-brand/70'
                }`}
                style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '4px' : '2px' }}
              />
            </button>
          )
        })}
      </div>

      <div className="mt-1 flex text-[9px] text-gray-400">
        {hours.map(({ hour }) => (
          <div key={hour} className="flex-1 text-center leading-tight">
            {hour % 3 === 0 ? formatHour(hour).replace(' ', '') : ''}
          </div>
        ))}
      </div>
    </div>
  )
}