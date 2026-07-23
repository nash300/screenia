alter table if exists public.legal_documents
  drop constraint if exists legal_documents_document_type_check;

alter table if exists public.legal_documents
  add constraint legal_documents_document_type_check
  check (document_type in ('terms', 'privacy', 'cookie', 'subscription_billing', 'support_service'));

alter table if exists public.customer_legal_agreements
  drop constraint if exists customer_legal_agreements_document_type_check;

alter table if exists public.customer_legal_agreements
  add constraint customer_legal_agreements_document_type_check
  check (document_type in ('terms', 'privacy', 'cookie', 'subscription_billing', 'support_service'));

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
    'cookie',
    'Cookie policy',
    '2026-07-12-prelaunch',
    '2026-07-12T00:00:00+02:00',
    '2026-07-12T00:00:00+02:00',
    'active',
    'Screenia använder nödvändiga tekniska cookies och webblagring för inloggning, kontosäkerhet, betalningsflöde, kundportal, adminpanel och displaydrift. Dessa används för att tjänsten ska fungera säkert och kan normalt inte stängas av i tjänsten.

Analys, marknadsföringspixlar, remarketing eller annan icke-nödvändig spårning får inte aktiveras utan tydligt samtycke, dokumenterat ändamål och möjlighet att neka eller återkalla samtycke.',
    'Nödvändiga cookies och lagring för säker inloggning, betalning och drift.',
    null
  ),
  (
    'subscription_billing',
    'Subscription and billing',
    '2026-07-12-prelaunch',
    '2026-07-12T00:00:00+02:00',
    '2026-07-12T00:00:00+02:00',
    'active',
    'Alla kundpriser som visas av Screenia inkluderar svensk moms. Första betalningen består av startavgift, vald enhet per skärm och frakt. Aktuella belopp beräknas i prisverktyget och visas i erbjudande, checkout, kvitto och fakturaunderlag innan betalning genomförs.

Månadsabonnemanget debiteras inte vid första betalningen. Det börjar debiteras efter den kostnadsfria provperioden. Stripe hanterar checkout, betalningsstatus, fakturor, kvitton, misslyckade betalningar, abonnemang och återbetalningsreferenser.

Vid uppsägning avslutas abonnemanget normalt vid slutet av den betalda perioden. Återbetalning kan hanteras om beställningen avbryts innan Screenia har registrerat att layout- eller produktionsarbete har startat.',
    'Priser, första betalning, provperiod, abonnemang, uppsägning, återbetalning och moms.',
    null
  ),
  (
    'support_service',
    'Support and service',
    '2026-07-12-prelaunch',
    '2026-07-12T00:00:00+02:00',
    '2026-07-12T00:00:00+02:00',
    'active',
    'Kunder kontaktar Screenia via service@screenia.se eller kundportalen för frågor om innehåll, leverans, fakturering, uppsägning, integritet eller tekniska problem. Screenia kan hjälpa till med planering, layout, ändringar, innehåll och drift enligt den valda tjänsten.

Fjärrsupport utförs endast efter kundens begäran eller samtycke. Logotyper, bilder, texter, menyer, kampanjer och instruktioner som kunden skickar används för att leverera tjänsten.

Supportåtgärder som påverkar order, betalning, åtkomst, integritet, kundradering, återbetalning eller displaydrift ska dokumenteras så att ärendet kan följas upp.',
    'Supportkanaler, kundmaterial, fjärrsupport och spårbar servicehantering.',
    null
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
