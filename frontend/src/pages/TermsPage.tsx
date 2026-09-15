const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'FitZone Gym'

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-gray-900">Terms &amp; conditions</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

      {/* This is placeholder/template copy, not legal advice - swap in terms reviewed by
          your own counsel before relying on this page. Structure mirrors what a gym
          membership agreement typically covers, matching the fee/cancellation rules
          already encoded in the invoice terms (see utils/invoice.ts). */}
      <div className="mt-8 space-y-8 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">1. Membership</h2>
          <p className="mt-2">
            A membership grants access to {GYM_NAME} for the plan duration purchased at
            the front desk. Membership is personal and non-transferable, and access is
            tied to the branch(es) assigned to your account.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">2. Fees and payment</h2>
          <p className="mt-2">
            Fees are due before the 10th of each month. A membership may be paused or
            cancelled if dues remain unpaid for two consecutive months. Fees already paid
            are not refundable, transferable, or extendable.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">3. Conduct and facility use</h2>
          <p className="mt-2">
            Members are expected to follow posted gym rules, re-rack equipment after use,
            and treat staff and other members respectfully. Management reserves the right
            to suspend access for conduct that endangers others or damages equipment.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">4. Assumption of risk</h2>
          <p className="mt-2">
            Physical exercise carries an inherent risk of injury. By training at {GYM_NAME},
            you confirm you're medically fit to do so and take responsibility for using
            equipment correctly, or with a trainer's guidance where appropriate.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">5. Changes to these terms</h2>
          <p className="mt-2">
            These terms may be updated from time to time. Continued use of your
            membership after a change means you accept the revised terms.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">6. Contact</h2>
          <p className="mt-2">
            Questions about these terms can be directed to the front desk at any branch,
            or via the contact details on our home page.
          </p>
        </section>
      </div>
    </div>
  )
}