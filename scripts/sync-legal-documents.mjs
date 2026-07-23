import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const activeLegalDocuments = [
  {
    document_type: "terms",
    title: "Villkor",
    version: "2026-07-12-prelaunch",
    effective_at: "2026-07-12T00:00:00+02:00",
    published_at: "2026-07-12T00:00:00+02:00",
    status: "active",
    summary: "Förlanseringsvillkor för Screenias digitala skärmtjänst.",
    content:
      "Screenia tillhandahåller en hanterad digital skärmtjänst med planeringsstöd, layoutarbete, enhetsadministration, innehållshantering och abonnemangsbaserad drift. Kunden ansvarar för att lämnade företags-, kontakt-, faktura- och leveransuppgifter är korrekta.\n\nFörsta betalningen omfattar startavgift, vald enhet och frakt. Månadsabonnemanget debiteras efter provperioden. Screenia kan stoppa eller begränsa åtkomst vid utebliven betalning, avslutat abonnemang, återbetalning, säkerhetsrisk eller felaktig användning.\n\nStartavgiften kan återbetalas om beställningen avbryts innan Screenia har registrerat att layout- eller produktionsarbete har startat. När arbetet har startat är startavgiften normalt inte återbetalningsbar. Åtgärder som påverkar betalning, åtkomst, uppsägning, återbetalning eller kunddata ska dokumenteras.",
    pdf_url: "/legal/villkor-current.pdf",
  },
  {
    document_type: "privacy",
    title: "Integritetspolicy",
    version: "2026-07-12-prelaunch",
    effective_at: "2026-07-12T00:00:00+02:00",
    published_at: "2026-07-12T00:00:00+02:00",
    status: "active",
    summary: "Så behandlar Screenia personuppgifter för förfrågningar, kunder, betalning och support.",
    content:
      "Screenia behandlar de personuppgifter som behövs för att hantera förfrågningar, kundkonto, betalning, fakturering, leverans, support, samtycken, uppladdat material, displaykonfiguration och revisionshistorik. Det kan omfatta namn, e-post, telefonnummer, företagsuppgifter, leveransadress, faktureringsuppgifter, meddelanden, uppladdade filer, samtycken, Stripe-referenser och tekniska händelser.\n\nScreenia använder Supabase för databas, inloggning och lagring, Stripe för betalningar och fakturor, Resend och Supabase för transaktionella e-postmeddelanden, Vercel för drift samt Loopia/Zoho för domän och e-post. Uppgifter delas endast när det behövs för att leverera, säkra, administrera eller följa upp tjänsten.\n\nKunden kan kontakta Screenia för tillgång, rättelse, radering, begränsning eller frågor om personuppgifter. Vissa uppgifter kan behöva sparas längre för bokföring, skatt, säkerhet, tvist, bedrägeriskydd eller rättsliga skyldigheter.",
    pdf_url: "/legal/integritetspolicy-current.pdf",
  },
  {
    document_type: "cookie",
    title: "Cookiepolicy",
    version: "2026-07-12-prelaunch",
    effective_at: "2026-07-12T00:00:00+02:00",
    published_at: "2026-07-12T00:00:00+02:00",
    status: "active",
    summary: "Nödvändiga cookies och lagring för säker inloggning, betalning och drift.",
    content:
      "Screenia använder nödvändiga tekniska cookies och webblagring för inloggning, kontosäkerhet, betalningsflöde, kundportal, adminpanel och displaydrift. Dessa används för att tjänsten ska fungera säkert och kan normalt inte stängas av i tjänsten.\n\nAnalys, marknadsföringspixlar, remarketing eller annan icke-nödvändig spårning får inte aktiveras utan tydligt samtycke, dokumenterat ändamål och möjlighet att neka eller återkalla samtycke.",
    pdf_url: null,
  },
  {
    document_type: "subscription_billing",
    title: "Abonnemang och betalning",
    version: "2026-07-12-prelaunch",
    effective_at: "2026-07-12T00:00:00+02:00",
    published_at: "2026-07-12T00:00:00+02:00",
    status: "active",
    summary: "Priser, första betalning, provperiod, abonnemang, uppsägning, återbetalning och moms.",
    content:
      "Alla kundpriser som visas av Screenia inkluderar svensk moms. Första betalningen består av startavgift, vald enhet per skärm och frakt. Aktuella belopp beräknas i prisverktyget och visas i erbjudande, checkout, kvitto och fakturaunderlag innan betalning genomförs.\n\nMånadsabonnemanget debiteras inte vid första betalningen. Det börjar debiteras efter den kostnadsfria provperioden. Stripe hanterar checkout, betalningsstatus, fakturor, kvitton, misslyckade betalningar, abonnemang och återbetalningsreferenser.\n\nVid uppsägning avslutas abonnemanget normalt vid slutet av den betalda perioden. Återbetalning kan hanteras om beställningen avbryts innan Screenia har registrerat att layout- eller produktionsarbete har startat.",
    pdf_url: null,
  },
  {
    document_type: "support_service",
    title: "Support och service",
    version: "2026-07-12-prelaunch",
    effective_at: "2026-07-12T00:00:00+02:00",
    published_at: "2026-07-12T00:00:00+02:00",
    status: "active",
    summary: "Supportkanaler, kundmaterial, fjärrsupport och spårbar servicehantering.",
    content:
      "Kunder kontaktar Screenia via service@screenia.se eller kundportalen för frågor om innehåll, leverans, fakturering, uppsägning, integritet eller tekniska problem. Screenia kan hjälpa till med planering, layout, ändringar, innehåll och drift enligt den valda tjänsten.\n\nFjärrsupport utförs endast efter kundens begäran eller samtycke. Logotyper, bilder, texter, menyer, kampanjer och instruktioner som kunden skickar används för att leverera tjänsten.\n\nSupportåtgärder som påverkar order, betalning, åtkomst, integritet, kundradering, återbetalning eller displaydrift ska dokumenteras så att ärendet kan följas upp.",
    pdf_url: null,
  },
];

const supabase = createClient(supabaseUrl, serviceRoleKey);

for (const document of activeLegalDocuments) {
  const { error } = await supabase
    .from("legal_documents")
    .upsert(document, { onConflict: "document_type,version" });

  if (error) throw error;
}

const { data, error } = await supabase
  .from("legal_documents")
  .select("document_type,title,version,status")
  .eq("status", "active")
  .order("document_type");

if (error) throw error;
console.log(JSON.stringify(data, null, 2));
