create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms', 'privacy')),
  title text not null,
  version text not null,
  effective_at timestamptz not null,
  published_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  content text not null,
  summary text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_type, version)
);

create index if not exists legal_documents_type_status_idx
  on public.legal_documents(document_type, status, effective_at desc);

create table if not exists public.customer_legal_agreements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  legal_document_id uuid references public.legal_documents(id) on delete set null,
  document_type text not null check (document_type in ('terms', 'privacy')),
  document_title text not null,
  document_version text not null,
  document_effective_at timestamptz,
  document_url text,
  pdf_url text,
  content_snapshot text not null,
  accepted_at timestamptz not null default now(),
  accepted_ip text,
  accepted_user_agent text,
  collection_point text not null,
  created_at timestamptz not null default now()
);

create index if not exists customer_legal_agreements_customer_idx
  on public.customer_legal_agreements(customer_id, document_type, accepted_at desc);

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
    '2026-05-28-draft',
    '2026-05-28T00:00:00+02:00',
    null,
    'active',
    'Detta är en platshållare för InfoSyncs villkor. Den slutliga juridiska texten läggs in här och versioneras innan tjänsten används i produktion.',
    'Utkast. Den slutliga villkorstexten ersätts här innan publicering.',
    '/legal/villkor-current.pdf'
  ),
  (
    'privacy',
    'Integritetspolicy',
    '2026-05-28-draft',
    '2026-05-28T00:00:00+02:00',
    null,
    'active',
    'Detta är en platshållare för InfoSyncs integritetspolicy. Den slutliga texten läggs in här och versioneras innan tjänsten används i produktion.',
    'Utkast. Den slutliga integritetstexten ersätts här innan publicering.',
    '/legal/integritetspolicy-current.pdf'
  )
on conflict (document_type, version) do update set
  title = excluded.title,
  effective_at = excluded.effective_at,
  status = excluded.status,
  content = excluded.content,
  summary = excluded.summary,
  pdf_url = excluded.pdf_url,
  updated_at = now();
