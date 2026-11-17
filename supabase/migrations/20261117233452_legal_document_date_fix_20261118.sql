update public.legal_documents
set effective_at = '2026-11-18T12:00:00+01:00',
    published_at = '2026-11-18T12:00:00+01:00',
    updated_at = now()
where document_type in ('terms', 'privacy')
  and version = '2026-11-18';
