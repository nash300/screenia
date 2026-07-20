This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

For the full local platform checklist, including Stripe webhooks, Supabase,
Resend, dashboard links, and social-login planning, see:

```text
LOCAL_DEV_REMINDER.md
```

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The Training catalog is reserved for future learning material. Email delivery
evidence is available through the admin Troubleshooting page and is intentionally
kept outside the daily workflow navigation. Internal operating and readiness
references are stored in `docs/admin-operations-guide.md` and
`docs/deployment-readiness.md`. Before a reviewed deployment, run:

```bash
npm run release:check
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Email Sending

Admin onboarding links are sent automatically through Resend. Add these values
to `.env.local` and to your production environment:

```bash
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=Screenia <service@screenia.se>
RESEND_NEWSLETTER_FROM_EMAIL=Screenia <info@screenia.se>
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_AUTOMATIC_TAX_ENABLED=false
SCREENIA_LIVE_PAYMENTS_ENABLED=false
SCREENIA_BUSINESS_REGISTRATION_CONFIRMED=false
SCREENIA_VAT_DECISION_CONFIRMED=false
SCREENIA_LEGAL_REVIEW_CONFIRMED=false
SCREENIA_LIVE_WEBHOOK_VERIFIED=false
SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=false
NEXT_PUBLIC_COMPANY_LEGAL_NAME=Screenia
NEXT_PUBLIC_COMPANY_ORG_NUMBER=your_registered_org_number
NEXT_PUBLIC_COMPANY_ADDRESS=your_registered_business_address
NEXT_PUBLIC_COMPANY_EMAIL=service@screenia.se
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
```

Without `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, Screenia prepares onboarding
links but does not send automatic emails. Use a verified Resend domain for
`RESEND_FROM_EMAIL` before sending to real customers outside Resend's test
limits. Use `service@screenia.se` for transactional/customer communication
and `info@screenia.se` for newsletters. Restart the Next.js development server
after changing `.env.local`; environment variables are loaded when the server
starts.

## Supabase Migrations

Production needs every SQL file in:

```text
supabase/migrations/
```

Run the files in timestamp order before relying on onboarding, payments,
customer material upload, device playlists, consent history, or system action
history in production.

## Production Go-Live Checklist

Before accepting real customers, confirm these production items:

- Run every SQL file in `supabase/migrations/` in timestamp order.
- Fill `stripe_setup_price_id`, `stripe_hardware_price_id`,
  `stripe_shipping_price_id`, and `stripe_monthly_price_id` in `pricing_plans`
  for both active packages, and verify every Stripe Price uses SEK and inclusive
  tax behavior.
- Configure the Stripe webhook endpoint to call `/api/stripe/webhook` and set
  `STRIPE_WEBHOOK_SECRET`.
- Keep `STRIPE_AUTOMATIC_TAX_ENABLED=false` until Stripe Tax is configured in
  the Stripe Dashboard with the correct registrations, product tax codes, and
  price tax behavior. Set it to `true` when Checkout should collect billing
  addresses, tax IDs, and calculate tax automatically.
- Keep all `SCREENIA_*_CONFIRMED` launch flags and
  `SCREENIA_LIVE_PAYMENTS_ENABLED=false` until the Swedish business
  registration, F/FA-skatt decision, VAT/moms decision, final policy review,
  live webhook checks, and Supabase Auth email delivery tests are complete. The
  checkout route blocks live Stripe keys unless every live-payment confirmation
  flag is explicitly set to `true`.
- Use a verified Resend sender domain for `RESEND_FROM_EMAIL`.
- Set `RESEND_FROM_EMAIL` to `Screenia <service@screenia.se>` and
  `RESEND_NEWSLETTER_FROM_EMAIL` to `Screenia <info@screenia.se>`.
- Configure Supabase Auth SMTP/custom email delivery and test customer password
  setup plus password reset before setting
  `SCREENIA_SUPABASE_AUTH_EMAIL_VERIFIED=true`.
- Set the public company variables above so the landing page shows registered
  business details.
- Create admin users in Supabase Auth and set each staff user's
  `app_metadata.role` to `admin`; `/admin` and the database policies require
  that role.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
