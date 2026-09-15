const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'FitZone Gym'
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'hello@mygym.com'

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-gray-900">Privacy policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>

      {/* Placeholder/template copy, not legal advice - have this reviewed for your
          jurisdiction before relying on it. Deliberately describes what this specific
          app actually stores (profile fields, attendance, payments, OTPs) rather than
          generic boilerplate, so it stays accurate as a starting point. */}
      <div className="mt-8 space-y-8 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">1. Information we collect</h2>
          <p className="mt-2">
            When you register or are added as a member, trainer, or staff account, we
            store your name, email, phone number, and optionally an address and profile
            photo. We also record your check-in/check-out activity, membership and
            payment history, and (for staff) a signature used on invoices.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">2. How we use it</h2>
          <p className="mt-2">
            This information is used to manage your membership, control gym access,
            generate invoices, and send account-related emails - such as one-time
            verification codes for registration, password resets, and password changes.
            We don't sell your information or use it for advertising.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">3. Verification codes</h2>
          <p className="mt-2">
            One-time codes sent for registration, password reset, or password change are
            stored only as a hash, expire after a short window, and are deleted once used
            or expired.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">4. Who can see your information</h2>
          <p className="mt-2">
            Managers and Owners at branches you're assigned to can view your profile,
            membership, and attendance details in order to serve you at the front desk.
            Your payment and invoice history is visible only to you and to staff at your
            branch(es).
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">5. Data retention and deletion</h2>
          <p className="mt-2">
            If your account is deleted, your profile, attendance history, and (for
            members) your own membership and payment records are removed. Payment
            records tied to another member that you recorded as staff are kept intact to
            preserve their invoice history.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-gray-900">6. Contact</h2>
          <p className="mt-2">
            For questions about your data, or to request a copy or deletion of your
            account, contact us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">{SUPPORT_EMAIL}</a>{' '}
            or speak to any branch of {GYM_NAME}.
          </p>
        </section>
      </div>
    </div>
  )
}