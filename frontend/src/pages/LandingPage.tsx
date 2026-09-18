import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Footer from '../components/Footer'
import { InstagramIcon, FacebookIcon } from '../components/SocialIcons'
import type { Branch } from '../types'

const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'FitZone Gym'
const GYM_LOGO_URL = import.meta.env.VITE_GYM_LOGO_URL || '/logo.svg'
const DIRECTOR_NAME = import.meta.env.VITE_DIRECTOR_NAME || 'Ramesh Mane'
const DIRECTOR_PHOTO_URL = import.meta.env.VITE_DIRECTOR_PHOTO_URL || ''
const ESTABLISHED_YEAR = Number(import.meta.env.VITE_GYM_ESTABLISHED_YEAR) || 1995
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'hello@mygym.com'
const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL || '#'
const FACEBOOK_URL = import.meta.env.VITE_FACEBOOK_URL || '#'

const yearsTraining = new Date().getFullYear() - ESTABLISHED_YEAR

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

// --- small line icons, hand-drawn to match Navbar.tsx's existing icon style ---

function DumbbellIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className}>
      <rect x="1" y="9" width="3" height="6" rx="1" /><rect x="5" y="7" width="2" height="10" rx="1" />
      <rect x="7" y="11" width="10" height="2" /><rect x="17" y="7" width="2" height="10" rx="1" />
      <rect x="20" y="9" width="3" height="6" rx="1" />
    </svg>
  )
}

function GroupIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9" cy="8" r="3" /><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <circle cx="17.5" cy="9.5" r="2.2" /><path d="M15.8 12.3c2.9.4 5.2 2.5 5.2 5.2" />
    </svg>
  )
}

function BuildingIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 7h1M8 11h1M8 15h1M15 7h1M15 11h1M15 15h1M10 21v-4h4v4" />
    </svg>
  )
}

function CoachIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      <path d="M9 18.5l2 2 4-4.5" />
    </svg>
  )
}

function DropletIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3c3.5 4 6 7.2 6 10.5A6 6 0 0 1 6 13.5C6 10.2 8.5 7 12 3z" />
    </svg>
  )
}

function LeafIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 4c-8 0-14 5-14 13v3h3c8 0 13-6 13-14V4z" />
      <path d="M6 20c2-4 5-7 12-10" />
    </svg>
  )
}

function MapPinIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  )
}

function PhoneIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3.6c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8z" />
    </svg>
  )
}

const PROGRAMS = [
  { icon: DumbbellIcon, title: 'Free weights & machines', text: 'A full floor of maintained strength equipment - no queuing for the one working machine.' },
  { icon: CoachIcon, title: 'Personal training', text: 'One-on-one programming from certified trainers, for beginners through competitive lifters.' },
  { icon: GroupIcon, title: 'Group classes', text: 'Coached sessions through the week, built for people who train better with company.' },
  { icon: BuildingIcon, title: 'One membership, every branch', text: 'A single plan gets you gym access at any of our locations - no separate sign-ups.' },
  { icon: DropletIcon, title: 'Lockers & showers', text: 'Clean changing rooms and secure lockers at every branch, included in your membership.' },
  { icon: LeafIcon, title: 'Nutrition guidance', text: 'Trainers help you pair training with eating that actually supports it.' },
]

const VALUES = [
  { icon: CoachIcon, title: 'Certified coaching', text: 'Every trainer on our floor is certified and hands-on, not just present.' },
  { icon: DumbbellIcon, title: 'Equipment that works', text: "Machines get maintained on a schedule, not just when something breaks." },
  { icon: GroupIcon, title: 'A community, not a crowd', text: "Members and staff know each other by name at every branch." },
]

export default function LandingPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')

  useEffect(() => {
    api.get<Branch[]>('/api/public/branches')
      .then((res) => {
        setBranches(res.data)
        if (res.data.length > 0) setSelectedBranchId(res.data[0].id)
      })
      .catch(() => { /* landing page still works fine with the branch list empty */ })
  }, [])

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) ?? branches[0] ?? null
  // Include the gym's own brand name, not just the branch name - "Andheri Branch, 123
  // MG Road" alone is often ambiguous enough that Google resolves it to the wrong place
  // entirely; prefixing the brand name is what actually disambiguates the search.
  const mapQuery = selectedBranch
    ? `${GYM_NAME} ${selectedBranch.name}, ${selectedBranch.address ?? ''}`
    : GYM_NAME
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
  const mapEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`

  return (
    <div>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-ink text-white">
        {/* Decorative weight-plate rings, echoing the dumbbell mark in the logo. The
            outer ring is the page's one deliberate motion - a very slow rotation,
            like a loaded bar settling. Purely decorative: aria-hidden. */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-1/2 hidden -translate-y-1/2 sm:block">
          <div className="animate-slow-spin h-[420px] w-[420px] rounded-full">
          {/* <div className="animate-slow-spin h-[420px] w-[420px] rounded-full border-[18px] border-white/[0.06]"> */}
            <img src={GYM_LOGO_URL}></img>
          </div>
          {/* <div className="absolute inset-16 rounded-full border-[14px] border-brand/20" /> */}
          {/* <div className="absolute inset-32 rounded-full border-[10px] border-white/[0.08]" /> */}
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:pb-32 sm:pt-20">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-gray-300">
            Training since {ESTABLISHED_YEAR}
          </span>

          <h1 className="mt-6 max-w-xl font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Strength training built for the long run.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-gray-300">
            {GYM_NAME} has trained members for {yearsTraining} years across
            {branches.length > 0 ? ` ${branches.length} branch${branches.length > 1 ? 'es' : ''}` : ' multiple branches'} -
            with certified coaches, equipment that's actually maintained, and one
            membership that works everywhere we operate.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/register" className="rounded-md bg-brand px-6 py-3 text-sm font-medium hover:bg-brand-dark">
              Become a member
            </Link>
            <a href="#branches" className="rounded-md border border-white/20 px-6 py-3 text-sm font-medium text-white hover:border-white/40">
              Find your branch
            </a>
          </div>
        </div>
      </section>

      {/* ---------- Stats strip - floating card bridging hero and About ---------- */}
      <div className="relative mx-auto -mt-10 max-w-5xl px-4">
        <div className="grid grid-cols-2 gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-4">
          {/* Figures below are illustrative starting points - update them to your own numbers. */}
          <div>
            <p className="font-display text-3xl font-semibold text-gray-900">{yearsTraining}+</p>
            <p className="mt-1 text-xs text-gray-500">Years training members</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold text-gray-900">{branches.length > 0 ? branches.length : '—'}</p>
            <p className="mt-1 text-xs text-gray-500">Branches</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold text-gray-900">20+</p>
            <p className="mt-1 text-xs text-gray-500">Certified trainers</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold text-gray-900">1,000+</p>
            <p className="mt-1 text-xs text-gray-500">Members trained</p>
          </div>
        </div>
      </div>

      {/* ---------- About Us ---------- */}
      <section id="about" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 p-6">
              {DIRECTOR_PHOTO_URL ? (
                <img src={DIRECTOR_PHOTO_URL} alt={DIRECTOR_NAME} className="h-28 w-28 rounded-full object-cover" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-brand/10 text-2xl font-semibold text-brand">
                  {initials(DIRECTOR_NAME)}
                </div>
              )}
              <p className="mt-4 font-display text-xl font-semibold text-gray-900">{DIRECTOR_NAME}</p>
              <p className="text-sm text-gray-500">Founder &amp; Director</p>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                "I opened our first branch in {ESTABLISHED_YEAR} with little more than a
                squat rack and a plan. {yearsTraining} years on, the equipment has
                changed - the idea that every member deserves a coach who actually pays
                attention hasn't."
              </p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-gray-900">About us</h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              Since {ESTABLISHED_YEAR}, {GYM_NAME} has grown from a single location into
              a multi-branch gym built around the same idea Director {DIRECTOR_NAME} started 
              with: real coaching, honest programming, and facilities worth showing up to. 
              Wherever you train with us, your membership, your check-ins, and your progress follow you.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {VALUES.map((v) => (
                <div key={v.title}>
                  <v.icon className="h-6 w-6 text-brand" />
                  <p className="mt-3 text-sm font-medium text-gray-900">{v.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">{v.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Programs ---------- */}
      <section id="programs" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-gray-900">What's included</h2>
          <p className="mt-3 max-w-xl text-sm text-gray-600">
            Every membership covers the same essentials at every branch - no add-on fees
            for the things a gym should already have.
          </p>

          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {PROGRAMS.map((p) => (
              <div key={p.title} className="rounded-lg border border-gray-200 bg-white p-6">
                <p.icon className="h-6 w-6 text-brand" />
                <p className="mt-4 font-medium text-gray-900">{p.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Branches & Contact ---------- */}
      <section id="branches" className="mx-auto max-w-6xl px-4 py-20">
        <h2 id="contact" className="font-display text-3xl font-semibold tracking-tight text-gray-900 scroll-mt-24">
          Visit a branch
        </h2>
        <p className="mt-3 max-w-xl text-sm text-gray-600">
          Every branch accepts every membership. Pick one below to see its address and
          location on the map.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  b.id === selectedBranchId ? 'border-brand bg-brand/5' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="font-medium text-gray-900">{b.name}</p>
                {b.address && (
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-500">
                    <MapPinIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    {b.address}
                  </p>
                )}
                {b.phone && (
                  <a href={`tel:${b.phone}`} onClick={(e) => e.stopPropagation()}
                    className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand">
                    <PhoneIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    {b.phone}
                  </a>
                )}
              </button>
            ))}
            {branches.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-400">
                Branch details will show up here once branches are added.
              </p>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm font-medium text-gray-900">Prefer to email or message us?</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2 block text-sm text-brand hover:underline">
                {SUPPORT_EMAIL}
              </a>
              <div className="mt-3 flex items-center gap-3">
                <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                  className="rounded-full border border-gray-200 p-2 text-gray-500 hover:border-brand hover:text-brand">
                  <InstagramIcon />
                </a>
                <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                  className="rounded-full border border-gray-200 p-2 text-gray-500 hover:border-brand hover:text-brand">
                  <FacebookIcon />
                </a>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 lg:col-span-3">
            <iframe
              key={mapEmbedSrc}
              title={`Map showing ${selectedBranch?.name ?? GYM_NAME}`}
              src={mapEmbedSrc}
              className="h-80 w-full lg:h-full lg:min-h-[420px]"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            {selectedBranch && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
                <p className="text-sm text-gray-600">{selectedBranch.name}</p>
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-brand hover:underline">
                  Get directions
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="bg-brand">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">Ready to start training?</h2>
            <p className="mt-2 max-w-md text-sm text-white/85">
              Sign up online, then pick up your membership at any branch - your QR code
              and PIN work the moment your first plan is active.
            </p>
          </div>
          <Link to="/register" className="flex-shrink-0 rounded-md bg-white px-6 py-3 text-sm font-medium text-brand hover:bg-gray-100">
            Become a member
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}