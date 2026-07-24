export const legalDocumentTypes = [
  "terms",
  "privacy",
  "cookie",
  "subscription_billing",
  "support_service",
] as const;

export type LegalDocumentType = (typeof legalDocumentTypes)[number];

export const legalDocumentLabels: Record<LegalDocumentType, string> = {
  terms: "Allmänna villkor",
  privacy: "Integritetspolicy",
  cookie: "Cookiepolicy",
  subscription_billing: "Abonnemangs- och betalningsvillkor",
  support_service: "Support- och servicevillkor",
};

const effectiveAt = "2026-07-24T00:00:00+02:00";
const draftVersion = "2026-07-24-avtalsutkast";

const termsContent = [
  "## 1. Om villkoren",
  "Dessa allmänna villkor gäller när ett företag eller en annan organisation beställer Screenias tjänst för digital skyltning. Villkoren blir bindande när kunden har godkänt dem och genomfört beställningen. En inskickad förfrågan är inte i sig en bindande beställning.",
  "Screenia tillhandahåller en förvaltad helhetslösning som kan omfatta planering, layout, skärmenhet, materialhantering, publicering, abonnemang och support. Den exakta omfattningen framgår av kundens erbjudande och beställningsunderlag.",
  "## 2. Kundens uppgifter och ansvar",
  "Kunden ansvarar för att företagsuppgifter, kontaktuppgifter, faktureringsuppgifter och leveransuppgifter är riktiga och fullständiga. Kunden ska utan dröjsmål meddela Screenia om en uppgift förändras.",
  "Kunden ansvarar för att material som lämnas till Screenia får användas för det avsedda ändamålet. Detta gäller bland annat logotyper, bilder, texter, menyer, filmer, musik och kampanjmaterial. Kunden ansvarar även för att innehållet inte strider mot lag eller gör intrång i tredje mans rätt.",
  "## 3. Beställning och betalning",
  "Före betalning får kunden information om valt paket, antal skärmar, första betalning, kommande månadsavgift och provperiod. Samtliga kundpriser anges inklusive svensk moms.",
  "Den första betalningen omfattar uppstartsavgift, valda skärmenheter och frakt. Månadsavgiften debiteras först efter den kostnadsfria provperioden. Närmare betalningsvillkor finns i Screenias abonnemangs- och betalningsvillkor.",
  "## 4. Layout och produktion",
  "Screenia påbörjar layout- och produktionsarbete efter beställningen enligt den plan som gäller för uppdraget. Kunden ska lämna efterfrågat material och återkoppla på förhandsgranskningar inom skälig tid. Försening som beror på att kunden inte lämnar nödvändigt material eller godkännande kan påverka leveranstiden.",
  "När Screenia har registrerat att layout- eller produktionsarbetet har påbörjats kan rätten till full återbetalning påverkas. Utfört arbete och uppkomna kostnader beaktas vid bedömningen.",
  "## 5. Leverans och aktivering",
  "Leverans sker till den adress som kunden har angett. Kunden ska kontrollera försändelsen och meddela Screenia så snart som möjligt om en enhet är skadad, saknas eller inte motsvarar beställningen.",
  "Skärmtjänsten aktiveras när nödvändiga kunduppgifter, betalningsuppgifter, enheter och material är i ordning. Beräknade leverans- och aktiveringstider är vägledande om inte annat uttryckligen har avtalats.",
  "## 6. Abonnemang och tillgång till tjänsten",
  "Kundens rätt att använda skärmtjänsten förutsätter ett giltigt abonnemang. Vid utebliven betalning, betalningstvist, återbetalning, paus, uppsägning eller annan omständighet som innebär att abonnemanget inte längre är giltigt får Screenia begränsa eller stänga av tjänsten.",
  "Screenia får även tillfälligt begränsa tjänsten om det behövs för säkerhet, underhåll eller för att förhindra användning som strider mot avtalet eller lag. Kunden ska informeras när det är skäligt och möjligt.",
  "## 7. Paus och uppsägning",
  "Kunden kan begära paus eller uppsägning genom kundportalen eller genom att kontakta Screenia. Uppsägning gäller normalt från utgången av den redan betalda perioden. Kunden har tillgång till tjänsten fram till dess, förutsatt att inga andra skäl för avstängning föreligger.",
  "Regler om paus, uppsägning av enskilda skärmar och återaktivering framgår närmare av abonnemangs- och betalningsvillkoren.",
  "## 8. Fel och support",
  "Kunden ska anmäla fel utan oskäligt dröjsmål och lämna de uppgifter som rimligen behövs för felsökning. Screenia ska inom skälig tid försöka avhjälpa fel som omfattas av tjänsten.",
  "Tillfälliga avbrott kan förekomma vid underhåll, fel hos kommunikations- eller underleverantör eller annan omständighet utanför Screenias rimliga kontroll. Screenia ska arbeta för att begränsa avbrottets omfattning och varaktighet.",
  "## 9. Ansvarsbegränsning",
  "Screenia ansvarar inte för indirekt skada, utebliven vinst eller förlust som beror på kundens material, kundens utrustning, internetanslutning eller användning i strid med instruktioner eller avtal. Begränsningen gäller inte i den utsträckning annat följer av tvingande lag.",
  "## 10. Personuppgifter",
  "Screenia behandlar personuppgifter enligt den integritetspolicy som gäller vid tidpunkten för behandlingen. Kunden ansvarar för att personer vars uppgifter lämnas till Screenia har fått nödvändig information.",
  "## 11. Ändringar och kontakt",
  "Screenia får ändra villkoren när det finns sakliga skäl, exempelvis på grund av lagändring, ändrad tjänst eller ändrade kostnader. En ändring som är väsentlig för ett pågående abonnemang ska meddelas i skälig tid innan den börjar gälla.",
  "Frågor om villkoren eller tjänsten skickas till service@screenia.se.",
  "## 12. Tillämplig lag och tvist",
  "Svensk lag ska tillämpas på avtalet. Parterna ska i första hand försöka lösa en tvist genom dialog. Om en uppgörelse inte kan nås ska tvisten avgöras av behörig svensk allmän domstol, om inte annat följer av tvingande lag.",
].join("\n\n");

const privacyContent = [
  "## 1. Personuppgiftsansvar",
  "Screenia ansvarar för behandlingen av personuppgifter som sker när en person skickar en förfrågan, företräder en kund, använder kundportalen, genomför en beställning eller kontaktar Screenias support.",
  "Frågor om personuppgifter och begäran om att utöva en rättighet skickas till service@screenia.se.",
  "## 2. Uppgifter som behandlas",
  "Screenia kan behandla namn, kontaktuppgifter, företagsuppgifter, leveransadress, faktureringsuppgifter, meddelanden, beställningsuppgifter, samtycken och uppgifter om kundens abonnemang.",
  "När kunden lämnar material till sin skärmlösning kan Screenia även behandla filer, bilder, texter och annan information som behövs för uppdraget. Betalkortsuppgifter lämnas direkt till betalningsleverantören och lagras inte av Screenia.",
  "## 3. Varför uppgifterna används",
  "Uppgifterna används för att besvara förfrågningar, lämna erbjudanden, ingå och fullgöra avtal, ta emot betalning, leverera utrustning, skapa och förvalta skärminnehåll, ge support samt hantera paus, uppsägning och återbetalning.",
  "Uppgifter används också när det är nödvändigt för bokföring, rättsliga krav, säkerhet, förebyggande av missbruk och för att kunna visa vad kunden och Screenia har kommit överens om.",
  "Frivillig marknadsföring, analys eller fjärrsupport grundas på kundens val när samtycke krävs. Ett samtycke kan återkallas utan att det påverkar lagligheten av tidigare behandling.",
  "## 4. Rättslig grund",
  "Behandling sker huvudsakligen för att fullgöra avtal eller vidta åtgärder inför avtal, för att uppfylla rättsliga skyldigheter samt med stöd av Screenias berättigade intresse av att administrera, skydda och utveckla tjänsten. När lag kräver samtycke används samtycke som rättslig grund.",
  "## 5. Mottagare och leverantörer",
  "Screenia delar endast uppgifter när det behövs för att tillhandahålla, administrera eller skydda tjänsten. Leverantörer används för webbdrift, datalagring, inloggning, betalning, fakturering, e-post, domän och företagskommunikation.",
  "De huvudsakliga leverantörerna är Vercel, Supabase, Stripe, Resend samt Loopia och Zoho. Leverantörerna får endast behandla uppgifter för avtalade ändamål och enligt tillämpliga dataskyddskrav.",
  "## 6. Överföring utanför EU och EES",
  "Vissa leverantörer kan behandla uppgifter utanför EU och EES. När en sådan överföring sker ska Screenia använda en tillåten överföringsmekanism och vid behov kompletterande skyddsåtgärder.",
  "## 7. Lagringstid",
  "Personuppgifter sparas inte längre än vad som behövs för respektive ändamål. Kund- och supportuppgifter gallras eller anonymiseras när de inte längre behövs, om det inte finns ett fortsatt rättsligt eller berättigat behov.",
  "Betalnings-, faktura- och bokföringsuppgifter kan behöva sparas under längre tid enligt lag. Uppgifter kan också bevaras under den tid som krävs för att hantera garanti, betalningstvist, rättsligt anspråk, säkerhetsincident eller misstänkt missbruk.",
  "## 8. Den registrerades rättigheter",
  "Den registrerade kan ha rätt att få tillgång till sina uppgifter, få felaktiga uppgifter rättade, begära radering eller begränsning samt invända mot viss behandling. I vissa fall finns rätt att få uppgifter överförda till en annan personuppgiftsansvarig.",
  "En begäran bedöms enligt tillämplig lag. Screenia kan behöva kontrollera identiteten innan en begäran genomförs. Om en uppgift måste bevaras enligt lag eller för att försvara ett rättsligt anspråk kan den inte alltid raderas omedelbart.",
  "Den som anser att personuppgifter behandlas felaktigt har rätt att lämna klagomål till Integritetsskyddsmyndigheten.",
  "## 9. Säkerhet",
  "Screenia använder organisatoriska och tekniska skyddsåtgärder för att begränsa åtkomst, skydda kundmaterial och minska risken för förlust, obehörig användning eller spridning. Åtkomst ges endast till personer och leverantörer som behöver uppgifterna för sitt uppdrag.",
  "## 10. Ändringar",
  "Integritetspolicyn kan uppdateras när tjänsten, leverantörerna eller lagkraven förändras. Den aktuella versionen publiceras på webbplatsen. Väsentliga ändringar meddelas på lämpligt sätt.",
].join("\n\n");

const cookieContent = [
  "## 1. Vad cookies är",
  "Cookies är små textfiler som sparas i webbläsaren. Liknande lagring kan användas för att komma ihåg en säker inloggning eller en inställning under ett besök.",
  "## 2. Nödvändiga cookies",
  "Screenia använder nödvändiga cookies och lokal lagring för säker inloggning, kundportal, administratörsfunktioner, betalningsflöde och drift av tjänsten. Dessa funktioner behövs för att webbplatsen och kundtjänsten ska fungera på ett säkert och tillförlitligt sätt.",
  "Nödvändiga cookies kräver normalt inte samtycke. Om de blockeras i webbläsaren kan inloggning, betalning eller andra centrala funktioner sluta fungera.",
  "## 3. Analys och marknadsföring",
  "Screenia använder inte analyscookies, marknadsföringspixlar eller liknande icke nödvändig spårning utan att först lämna tydlig information och, när det krävs, inhämta samtycke.",
  "Ett samtycke ska kunna nekas och återkallas lika enkelt som det lämnas. En återkallelse påverkar inte lagligheten av behandling som redan har skett.",
  "## 4. Webbläsarinställningar",
  "Kunden kan radera eller blockera cookies genom webbläsarens inställningar. Inställningarna varierar mellan olika webbläsare. Blockering av nödvändiga cookies kan begränsa webbplatsens funktion.",
  "## 5. Kontakt och ändringar",
  "Frågor om cookies skickas till service@screenia.se. Den aktuella versionen av cookiepolicyn publiceras på webbplatsen och uppdateras om användningen förändras.",
].join("\n\n");

const billingContent = [
  "## 1. Priser",
  "Samtliga priser som visas för kund anges i svenska kronor och inkluderar svensk moms. Det pris som kunden ska betala framgår före beställningen genomförs.",
  "## 2. Första betalningen",
  "Den första betalningen består av uppstartsavgift, pris för valda skärmenheter och frakt. Vilka delar som ingår och vilket belopp som gäller framgår av kundens aktuella erbjudande och visas på nytt innan betalningen genomförs.",
  "Om beställningen omfattar flera skärmar beräknas uppstartsavgift, enheter och frakt utifrån det antal och de paket som kunden har valt. Kunden får alltid möjlighet att kontrollera den fullständiga beräkningen före betalning.",
  "## 3. Provperiod och månadsavgift",
  "Månadsavgiften debiteras inte vid den första betalningen. Provperiodens längd och den månadsavgift som därefter gäller framgår av kundens aktuella erbjudande och beställningsunderlag.",
  "Om Screenia ändrar sina allmänna priser påverkar ändringen inte ett redan lämnat erbjudande under dess angivna giltighetstid. Prisändringar för ett pågående abonnemang ska meddelas i skälig tid innan de börjar gälla.",
  "## 4. Betalning",
  "Betalning genomförs genom Screenias betalningsleverantör. Kunden ansvarar för att betalningsuppgifterna är aktuella och att det finns täckning för förfallna belopp.",
  "Vid misslyckad betalning får Screenia försöka ta emot betalningen på nytt och kontakta kunden. Tjänsten kan begränsas eller stängas av till dess att betalningen har reglerats.",
  "## 5. Paus",
  "Kunden kan pausa hela abonnemanget eller en enskild skärm under en period om en till fyra månader. Under pausperioden är den berörda skärmtjänsten avstängd och den berörda månadsdebiteringen pausad enligt bekräftelsen.",
  "Pausen avslutas automatiskt på det datum som anges i bekräftelsen, om kunden och Screenia inte kommer överens om något annat. Kunden kan kontakta Screenia om tjänsten ska återaktiveras tidigare.",
  "En skärm som redan är pausad eller under uppsägning kan inte samtidigt omfattas av en ny motstridig åtgärd.",
  "## 6. Uppsägning",
  "Abonnemanget har ingen fast bindningstid. Uppsägning gäller normalt vid utgången av den redan betalda perioden. Kunden kan använda tjänsten fram till dess.",
  "Kunden kan säga upp en eller flera skärmar och behålla övriga aktiva skärmar. Om samtliga återstående skärmar ska avslutas ska hela abonnemanget sägas upp.",
  "En minskning av antalet skärmar påverkar kommande debiteringar. Någon proportionell återbetalning för den redan betalda perioden görs normalt inte.",
  "## 7. Återbetalning",
  "Om beställningen avbryts innan Screenia har påbörjat layout- eller produktionsarbete kan kunden begära full återbetalning av den första betalningen.",
  "Om arbetet har påbörjats gör Screenia en individuell bedömning med hänsyn till utfört arbete, levererad utrustning och uppkomna kostnader. Resultatet kan bli full återbetalning, delåterbetalning eller avslag.",
  "En godkänd återbetalning genomförs till det betalningssätt som användes vid köpet, om inte annat krävs av betalningsleverantören eller följer av lag.",
  "## 8. Frågor och invändningar",
  "Frågor om faktura, betalning, paus, uppsägning eller återbetalning skickas till service@screenia.se. Kunden bör ange företagsnamn och ordernummer för att underlätta handläggningen.",
].join("\n\n");

const supportContent = [
  "## 1. Supportens omfattning",
  "Screenia ger support för den tjänst och utrustning som omfattas av kundens beställning. Supporten kan avse material, layout, publicering, leverans, skärmdrift, konto, betalning, paus, uppsägning och integritetsfrågor.",
  "## 2. Kontaktvägar",
  "Kunden kontaktar Screenia genom kundportalen eller via service@screenia.se. För att ett ärende ska kunna hanteras effektivt bör kunden ange företagsnamn, berörd skärm eller order och en tydlig beskrivning av frågan eller felet.",
  "## 3. Kundens medverkan",
  "Kunden ska lämna den information som rimligen behövs för felsökning och följa skäliga instruktioner. Om felet finns i kundens internetanslutning, egen utrustning eller material kan Screenia vägleda kunden men ansvarar inte för den externa tjänsten eller utrustningen.",
  "## 4. Fjärrsupport",
  "Fjärrsupport genomförs endast på kundens begäran eller efter kundens godkännande. Åtkomsten ska begränsas till vad som behövs för det aktuella ärendet och avslutas när åtgärden är klar.",
  "## 5. Svar och åtgärd",
  "Screenia bekräftar supportärenden inom skälig tid. Ärenden som rör betalnings- och åtkomstfel, säkerhet eller integritet prioriteras. Den faktiska lösningstiden beror på felets art, kundens medverkan och om en extern leverantör behöver medverka.",
  "## 6. Planerat underhåll och avbrott",
  "Screenia får genomföra planerat underhåll när det behövs för säkerhet och drift. Kunden ska informeras i förväg när underhållet förväntas påverka tjänsten i mer än obetydlig omfattning.",
  "Vid ett oplanerat avbrott ska Screenia arbeta för att återställa tjänsten så snart som rimligen är möjligt och hålla berörda kunder informerade när avbrottet är väsentligt.",
  "## 7. Dokumentation",
  "Supportåtgärder som påverkar betalning, åtkomst, kunduppgifter, återbetalning eller skärmdrift dokumenteras för att ärendet ska kunna följas upp och för att Screenia ska kunna visa vad som har gjorts.",
  "## 8. Klagomål",
  "Ett klagomål ska skickas till service@screenia.se med en beskrivning av vad kunden anser är fel och vilken lösning som önskas. Screenia ska utreda klagomålet sakligt och återkomma inom skälig tid.",
].join("\n\n");

export const defaultLegalDocuments = [
  {
    document_type: "terms",
    title: "Allmänna villkor",
    version: draftVersion,
    effective_at: effectiveAt,
    status: "active",
    summary: "Villkor för beställning och användning av Screenias förvaltade tjänst för digital skyltning.",
    content: termsContent,
    pdf_url: null,
  },
  {
    document_type: "privacy",
    title: "Integritetspolicy",
    version: draftVersion,
    effective_at: effectiveAt,
    status: "active",
    summary: "Information om hur Screenia samlar in, använder, delar och bevarar personuppgifter.",
    content: privacyContent,
    pdf_url: null,
  },
  {
    document_type: "cookie",
    title: "Cookiepolicy",
    version: draftVersion,
    effective_at: effectiveAt,
    status: "active",
    summary: "Information om nödvändiga cookies och annan lagring som används på Screenias webbplats.",
    content: cookieContent,
    pdf_url: null,
  },
  {
    document_type: "subscription_billing",
    title: "Abonnemangs- och betalningsvillkor",
    version: draftVersion,
    effective_at: effectiveAt,
    status: "active",
    summary: "Villkor för priser, första betalning, provperiod, abonnemang, paus, uppsägning och återbetalning.",
    content: billingContent,
    pdf_url: null,
  },
  {
    document_type: "support_service",
    title: "Support- och servicevillkor",
    version: draftVersion,
    effective_at: effectiveAt,
    status: "active",
    summary: "Villkor för kontakt, support, felsökning, underhåll och hantering av klagomål.",
    content: supportContent,
    pdf_url: null,
  },
] satisfies Array<{
  document_type: LegalDocumentType;
  title: string;
  version: string;
  effective_at: string;
  status: "active" | "draft" | "archived";
  summary: string;
  content: string;
  pdf_url: string | null;
}>;
