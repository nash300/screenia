update public.legal_documents
set status = 'archived',
    updated_at = now()
where document_type in ('terms', 'privacy')
  and version <> '2026-07-12-prelaunch';

insert into public.legal_documents (
  document_type,
  title,
  version,
  effective_at,
  published_at,
  status,
  content,
  summary,
  pdf_url
)
values
  (
    'terms',
    'Villkor',
    '2026-07-12-prelaunch',
    '2026-07-12T00:00:00+02:00',
    '2026-07-12T00:00:00+02:00',
    'active',
    'Screenia provides managed digital screen setup, content collection, device administration, and subscription-based display service for Swedish customers. During pre-launch, orders and payments are tested in Stripe test mode unless Screenia has explicitly enabled live payments after business registration, tax/VAT readiness, and final policy review. Customers must provide accurate company/contact, billing, and delivery details. The first setup and device preparation work may affect refund rights once layout or production work has started. Monthly subscription access depends on a paid and active subscription. If a subscription is cancelled at period end, service access continues until the paid-through date. Screenia may block display access for paused subscriptions, failed payments, refunds, cancellations, expired entitlement, misuse, or operational/security risk. Admin actions affecting billing or access must be recorded in the audit trail.',
    'Pre-launch version. Screenia can be tested with test customers and Stripe test mode, but live customer payments must wait until business, tax, and final legal readiness are complete.',
    '/legal/villkor-current.pdf'
  ),
  (
    'privacy',
    'Integritetspolicy',
    '2026-07-12-prelaunch',
    '2026-07-12T00:00:00+02:00',
    '2026-07-12T00:00:00+02:00',
    'active',
    'Screenia stores only the customer, billing, support, consent, content, device, order, and subscription information needed to provide and administer the service. This may include company name, contact person, email, phone, delivery address, uploaded display material, messages, consent choices, Stripe identifiers, subscription status, audit events, and device/display configuration. Screenia uses Supabase for application data, Stripe for payments, Resend/Supabase email services for transactional messages, Vercel for hosting, and Loopia for domain/email services. Screenia records consent and audit history so customer actions, legal acceptance, payment events, admin changes, support updates, and deletion/refund actions can be traced. Customers can contact Screenia to request access, correction, deletion, or support with privacy questions. Some records may need to be retained for accounting, tax, fraud-prevention, security, dispute, or legal obligations.',
    'Pre-launch privacy version for Screenia testing and launch preparation. Final review is required before accepting live customers.',
    '/legal/integritetspolicy-current.pdf'
  )
on conflict (document_type, version) do update set
  title = excluded.title,
  effective_at = excluded.effective_at,
  published_at = excluded.published_at,
  status = excluded.status,
  content = excluded.content,
  summary = excluded.summary,
  pdf_url = excluded.pdf_url,
  updated_at = now();
