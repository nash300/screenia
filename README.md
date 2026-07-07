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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Email Sending

Admin onboarding links are sent automatically through Resend. Add these values
to `.env.local` and to your production environment:

```bash
RESEND_API_KEY=your_resend_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_AUTOMATIC_TAX_ENABLED=false
NEXT_PUBLIC_COMPANY_LEGAL_NAME=InfoSync
NEXT_PUBLIC_COMPANY_ORG_NUMBER=your_registered_org_number
NEXT_PUBLIC_COMPANY_ADDRESS=your_registered_business_address
NEXT_PUBLIC_COMPANY_EMAIL=hello@infosync.se
```

Without `RESEND_FROM_EMAIL`, local development uses Resend's starter sender:

```bash
RESEND_FROM_EMAIL=InfoSync <onboarding@resend.dev>
```

Use a verified Resend domain for `RESEND_FROM_EMAIL` before sending to real
customers outside Resend's test limits. Restart the Next.js development server
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
- Fill `stripe_setup_price_id` and `stripe_monthly_price_id` in `pricing_plans`
  for both active packages.
- Configure the Stripe webhook endpoint to call `/api/stripe/webhook` and set
  `STRIPE_WEBHOOK_SECRET`.
- Keep `STRIPE_AUTOMATIC_TAX_ENABLED=false` until Stripe Tax is configured in
  the Stripe Dashboard with the correct registrations, product tax codes, and
  price tax behavior. Set it to `true` when Checkout should collect billing
  addresses, tax IDs, and calculate tax automatically.
- Use a verified Resend sender domain for `RESEND_FROM_EMAIL`.
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
