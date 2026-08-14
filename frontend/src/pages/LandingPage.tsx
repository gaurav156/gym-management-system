import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-24 text-center">
          <h1 className="text-4xl font-semibold sm:text-5xl">Train harder. Live stronger.</h1>
          <p className="mx-auto mt-4 max-w-xl text-gray-300">
            Modern equipment, expert trainers, and a community that keeps you accountable.
            Join {import.meta.env.VITE_GYM_NAME} today.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/register" className="rounded-md bg-brand px-6 py-3 font-medium hover:bg-brand-dark">
              Become a member
            </Link>
            <Link to="/login" className="rounded-md border border-gray-500 px-6 py-3 font-medium hover:border-gray-300">
              Member login
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold">Flexible plans</h3>
            <p className="mt-2 text-sm text-gray-600">1-month, 3-month, and annual memberships to fit your goals.</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold">Multiple branches</h3>
            <p className="mt-2 text-sm text-gray-600">Train at any of our locations with a single membership.</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold">Gym store</h3>
            <p className="mt-2 text-sm text-gray-600">Grab supplements and merchandise right from the front desk.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
