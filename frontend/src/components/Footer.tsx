import { Link } from 'react-router-dom'
import { InstagramIcon, FacebookIcon } from './SocialIcons'

const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'FitZone Gym'
const GYM_LOGO_URL = import.meta.env.VITE_GYM_LOGO_URL || '/logo.svg'
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'hello@mygym.com'
const INSTAGRAM_URL = import.meta.env.VITE_INSTAGRAM_URL || '#'
const FACEBOOK_URL = import.meta.env.VITE_FACEBOOK_URL || '#'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-ink text-gray-400">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <img src={GYM_LOGO_URL} alt="" className="h-6 w-6" />
              {GYM_NAME}
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed">
              Real coaching, well-kept equipment, and a membership that works the same
              way at every branch.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="rounded-full border border-white/15 p-2 text-gray-300 transition-colors hover:border-brand hover:text-white">
                <InstagramIcon />
              </a>
              <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="rounded-full border border-white/15 p-2 text-gray-300 transition-colors hover:border-brand hover:text-white">
                <FacebookIcon />
              </a>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white">Explore</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#about" className="hover:text-white">About us</a></li>
              <li><a href="#programs" className="hover:text-white">Programs</a></li>
              <li><a href="#branches" className="hover:text-white">Branches</a></li>
              <li><a href="#contact" className="hover:text-white">Contact</a></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium text-white">Account</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/register" className="hover:text-white">Become a member</Link></li>
              <li><Link to="/login" className="hover:text-white">Member login</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium text-white">Get in touch</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">{SUPPORT_EMAIL}</a>
              </li>
              <li>See branch phone numbers in the Contact section</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} {GYM_NAME}. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/terms" className="hover:text-white">Terms &amp; conditions</Link>
            <Link to="/privacy" className="hover:text-white">Privacy policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}