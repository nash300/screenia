-- Publish the current customer-facing legal versions used by checkout.
-- Existing agreements and consent records are retained; only active document
-- pointers are moved to the current versions.

update public.legal_documents
set status = 'archived',
    updated_at = now()
where document_type in ('terms', 'privacy')
  and status = 'active'
  and version <> '2026-11-18';

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
  'Allmänna villkor',
  '2026-11-18',
  '2026-11-18T00:00:00+01:00',
  '2026-11-18T00:00:00+01:00',
  'active',
  $$## 1. Om villkoren

Dessa villkor gäller när ett företag eller en annan organisation beställer Screenias tjänst för digital skyltning. Om en privatperson handlar som konsument gäller tvingande konsumentlagstiftning före motstridiga delar av dessa villkor.

## 2. Kundens uppgifter, material och visning

Kunden ansvarar för riktiga företags-, kontakt-, fakturerings- och leveransuppgifter samt för att lämnat material får användas. Kunden ansvarar också för riktigheten i priser, öppettider, erbjudanden och annan information som kunden godkänner för publicering. Screenia visar normalt en liten Screenia-logotyp och webbadressen screenia.se; kunden kan begära att dessa tas bort. Layouter tillhandahålls på svenska eller engelska.

## 3. Beställning och betalning

Den första betalningen omfattar uppstartsavgift, valda skärmenheter och frakt. Månadsavgiften debiteras först efter den avtalade kostnadsfria provperioden. Aktuella priser och villkor visas före betalning.

## 4. Layout, innehåll och ändringar

Screenia rekommenderar hur layout och informationsmängd kan göras tydlig och lättläst. Kunden ska lämna korrekt material. Antalet ändringar är inte fast begränsat, men ändringar ska vara rimliga och bygga på korrekt underlag. Extra arbete på grund av felaktigt eller ofullständigt underlag, eller på grund av att kunden väljer mer information än Screenia rekommenderar, kan debiteras med den då gällande startavgiften.

## 5. Enheter, miljö och nätverk

Tjänsten får endast användas med de skärmenheter som Screenia säljer eller uttryckligen godkänner. Användning med andra enheter kan leda till omedelbart avslut. Enheten ska placeras torrt, ventilerat och skyddat från ånga, fett, vätska, värme, damm, stötar och annan olämplig påverkan. Kunden ansvarar för kompatibilitet mellan Screenias enhet och kundens egen TV eller skärm. Screenia rekommenderar minst 10 Mbit/s nedladdning och 5 Mbit/s uppladdning per aktiv skärm, med trådbunden anslutning när det är möjligt. Problem som beror på kundens Wi-Fi eller internetanslutning ligger normalt utanför Screenias ansvar efter provperioden. Kunden ska testa tjänsten under provperioden.

## 6. Leverans och garanti för enheter

Kunden ska omedelbart meddela Screenia om en enhet är skadad, saknas eller inte motsvarar beställningen. Om inget annat anges gäller ett års garanti för Screenias enheter från den dag kunden tar emot paketet. Garantin gäller inte fel som beror på felaktig användning, olämplig miljö, synlig skada, normalt slitage eller annan yttre omständighet. Kunden ska meddela Screenia när ett fel upptäcks. Om felet beror på en felaktig enhet skickar Screenia en ersättningsenhet utan kostnad inklusive utgående frakt. Kunden betalar returfrakten, om inte tvingande lag eller Screenia beslutar annat. Lagstadgade konsumenträttigheter påverkas inte.

## 7. Provperiod, retur och återbetalning

Kunden ska meddela Screenia via e-post eller kundprofil före provperiodens slut om en enhet ska returneras. Datumet för meddelandet används vid beräkningen av provperioden. För företagskunder ska en frivillig provretur följa Screenias instruktioner; enheten ska vara i ursprungligt skick, i originalförpackning och komplett. Kunden står för returfrakten. Screenia får göra ett dokumenterat avdrag för värdeminskning. Vid väsentlig skada eller saknade delar får Screenia neka den frivilliga provreturen, skicka tillbaka enheten på kundens bekostnad och inte göra någon återbetalning. För konsumenter gäller i stället lagstadgad ångerrätt och konsumentköplagens regler. Efter provperioden äger kunden betalda enheter och kan använda dem som smart-tv-boxar; Screenia kan skicka återställningsinstruktioner. Startavgiften återbetalas normalt inte till företagskunder när arbetet har påbörjats, men tvingande konsumentregler gäller alltid.

## 8. Abonnemang och tillgång till tjänsten

Rätten att använda tjänsten förutsätter ett giltigt abonnemang. Screenia får begränsa eller stänga av tjänsten vid utebliven betalning, uppsägning, återbetalning, säkerhetsrisk eller avtalsbrott.

## 9. Paus, uppsägning och avslut

Kunden kan begära paus eller uppsägning via kundprofilen eller genom att kontakta Screenia. Uppsägning gäller normalt vid slutet av den redan betalda perioden.

## 10. Fel och support

Kunden ska anmäla fel utan oskäligt dröjsmål. Screenia kan be om fotografier eller annan dokumentation för felsökning och kan spara materialet för dokumentation, garanti, framtida felsökning, säkerhet eller rättsliga krav enligt integritetspolicyn.

## 11. Ansvarsbegränsning och verksamhetens upphörande

Screenia ansvarar inte för indirekt skada eller förlust som beror på kundens material, utrustning, internetanslutning eller användning i strid med instruktioner eller avtal, om inte tvingande lag säger annat. Om Screenia behöver upphöra informeras kunden så snart som möjligt. Där det är praktiskt möjligt fortsätter tjänsten till sista dagen i den redan betalda perioden. Giltiga garanti- och reklamationskrav hanteras enligt tvingande lag, lämnade garantivillkor och tillgängliga rättsliga möjligheter.

## 12. Personuppgifter

Screenia behandlar personuppgifter enligt den integritetspolicy som gäller vid tidpunkten för behandlingen.

## 13. Ändringar och kontakt

Viktiga uppdateringar om priser, villkor och tjänsten skickas till kundens registrerade e-postadress och publiceras på webbplatsen eller i kundprofilen. Kunden ansvarar för att bevaka informationen. Frågor skickas till service@screenia.se.

## 14. Tillämplig lag och tvist

Svensk lag gäller. Tvister ska i första hand lösas genom dialog och annars av behörig svensk domstol, om inte tvingande lag säger annat.$$,
  'Aktuella villkor för beställning och användning av Screenias förvaltade tjänst för digital skyltning.',
  null
),
(
  'privacy',
  'Integritetspolicy',
  '2026-11-18',
  '2026-11-18T00:00:00+01:00',
  '2026-11-18T00:00:00+01:00',
  'active',
  $$## 1. Personuppgiftsansvar

Screenia ansvarar för personuppgifter som behandlas när en person skickar en förfrågan, företräder en kund, använder kundprofilen, genomför en beställning eller kontaktar supporten.

## 2. Uppgifter och ändamål

Screenia kan behandla kontakt-, företags-, leverans-, fakturerings-, beställnings-, abonnemangs-, meddelande- och samtyckesuppgifter samt material som kunden laddar upp. Uppgifterna används för avtal, betalning, leverans, skärminnehåll, support, säkerhet, bokföring och rättsliga krav.

## 3. Felsökningsbilder och dokumentation

Fotografier och annan dokumentation som kunden skickar vid felsökning kan behandlas och sparas för att hantera ärendet, dokumentera fel, bedöma garanti eller reklamation, förebygga återkommande fel och skydda Screenias eller kundens rättigheter. Materialet raderas eller anonymiseras när det inte längre behövs, om det inte behöver bevaras för ett rättsligt anspråk, en säkerhetsutredning eller annan rättslig skyldighet.

## 4. Leverantörer och lagring

Uppgifter delas endast med leverantörer som behövs för tjänsten, exempelvis drift, lagring, inloggning, betalning och e-post. Uppgifter sparas inte längre än vad som behövs, med undantag för lagstadgade krav, garanti, tvist, säkerhet och andra rättsliga skyldigheter.

## 5. Rättigheter och kontakt

Den registrerade kan ha rätt till tillgång, rättelse, radering, begränsning och invändning enligt tillämplig lag. Frågor skickas till service@screenia.se. Klagomål kan lämnas till Integritetsskyddsmyndigheten.$$,
  'Information om hur Screenia samlar in, använder, delar och bevarar personuppgifter.',
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
