export interface BroadcastTemplate { id: string; label: string; html: string }

// Plain tables + inline CSS: that's what Gmail/Outlook/Apple Mail render reliably. {{name}} is
// replaced per recipient. Swap the image URLs for your own (use "Insert image").
export const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    id: 'promo',
    label: 'Promo offer',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="background:#e11d48;padding:44px 32px;text-align:center;">
    <div style="font-size:13px;letter-spacing:3px;color:#fecdd3;font-weight:700;">LIMITED TIME</div>
    <div style="font-size:44px;line-height:1.1;color:#ffffff;font-weight:800;margin:10px 0;">FLAT 20% OFF</div>
    <div style="font-size:16px;color:#ffe4e6;">on all annual memberships</div>
  </td></tr>
  <tr><td style="padding:32px;text-align:center;">
    <p style="margin:0 0 8px;font-size:18px;color:#111827;font-weight:600;">Hi {{name}},</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">Lock in a year of training at our lowest price. Offer ends Sunday - show this email at the front desk.</p>
    <a href="https://example.com" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 32px;border-radius:999px;">Claim the offer</a>
  </td></tr>
</table>`,
  },
  {
    id: 'announcement',
    label: 'Announcement',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="border-top:6px solid #e11d48;padding:32px;">
    <div style="font-size:12px;letter-spacing:2px;color:#e11d48;font-weight:700;">IMPORTANT UPDATE</div>
    <h1 style="margin:8px 0 12px;font-size:26px;line-height:1.25;color:#111827;">New gym timings from Monday</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4b5563;">Hi {{name}}, from next Monday our branches will follow the schedule below.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;">
      <tr><td style="padding:14px 18px;font-size:14px;color:#6b7280;">Weekdays</td><td style="padding:14px 18px;font-size:14px;color:#111827;font-weight:600;text-align:right;">5:30 AM - 10:30 PM</td></tr>
      <tr><td style="padding:14px 18px;font-size:14px;color:#6b7280;border-top:1px solid #e5e7eb;">Sundays</td><td style="padding:14px 18px;font-size:14px;color:#111827;font-weight:600;text-align:right;border-top:1px solid #e5e7eb;">7:00 AM - 12:00 PM</td></tr>
    </table>
  </td></tr>
</table>`,
  },
  {
    id: 'event',
    label: 'Event invite',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="background:#111827;padding:36px 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#e11d48;border-radius:12px;padding:10px 16px;text-align:center;">
        <div style="font-size:12px;color:#ffe4e6;font-weight:700;">MAR</div>
        <div style="font-size:28px;color:#ffffff;font-weight:800;line-height:1;">15</div>
      </td>
      <td style="padding-left:18px;">
        <div style="font-size:22px;color:#ffffff;font-weight:700;">Community Fitness Day</div>
        <div style="font-size:14px;color:#9ca3af;margin-top:4px;">Free group classes - all branches</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4b5563;">Hi {{name}}, bring a friend and join us for a day of free classes, body-composition checks and healthy snacks.</p>
    <a href="https://example.com" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 28px;border-radius:8px;">Reserve my spot</a>
  </td></tr>
</table>`,
  },
]