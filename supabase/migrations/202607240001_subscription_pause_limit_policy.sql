update public.legal_documents
set status = 'archived'
where document_type = 'subscription_billing'
  and status = 'active';

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
values (
  'subscription_billing',
  'Abonnemang och betalning',
  '2026-07-24-pause-limit',
  '2026-07-24T00:00:00+02:00',
  '2026-07-24T00:00:00+02:00',
  'active',
  'Alla kundpriser som visas av Screenia inkluderar svensk moms. Första betalningen består av startavgift, vald enhet per skärm och frakt. Aktuella belopp beräknas i prisverktyget och visas i erbjudande, checkout, kvitto och fakturaunderlag innan betalning genomförs.

Månadsabonnemanget debiteras inte vid första betalningen. Det börjar debiteras efter den kostnadsfria provperioden. Stripe hanterar checkout, betalningsstatus, fakturor, kvitton, misslyckade betalningar, abonnemang och återbetalningsreferenser.

Kunden kan begära en tillfällig paus i kundportalen. En kundinitierad paus kan vara högst fyra månader, stoppar skärmtjänsten under pausperioden och återaktiveras automatiskt vid pausens slut om inget annat avtalas med Screenia.

Vid uppsägning avslutas abonnemanget normalt vid slutet av den betalda perioden. Återbetalning kan hanteras om beställningen avbryts innan Screenia har registrerat att layout- eller produktionsarbete har startat.',
  'Priser, första betalning, provperiod, abonnemang, paus, uppsägning, återbetalning och moms.',
  null
)
on conflict (document_type, version) do update
set title = excluded.title,
    effective_at = excluded.effective_at,
    published_at = excluded.published_at,
    status = excluded.status,
    content = excluded.content,
    summary = excluded.summary,
    pdf_url = excluded.pdf_url;
