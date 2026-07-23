import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getRequestIp, recordAuditEvent } from "@/lib/server/audit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ContentKind = "slide" | "benefit";
type ContentAction = "create" | "update" | "delete" | "move";

const publishedFallback = {
  slides: [
    { id: "published-slide-01", image_url: "/landing/hero-slides/01/image.png", title: "Förvandla förbipasserande till kunder", body: "Visa det som gör ditt företag unikt och locka fler besökare att komma in.", sort_order: 1, is_active: true },
    { id: "published-slide-02", image_url: "/landing/hero-slides/02/image.png", title: "Din befintliga skärm är allt som behövs", body: "Vår lösning fungerar med både TV-apparater och professionella skyltskärmar i olika storlekar.", sort_order: 2, is_active: true },
    { id: "published-slide-03", image_url: "/landing/hero-slides/03/image.png", title: "Slipp dyra installationer och komplicerade system", body: "Använd din befintliga TV och börja marknadsföra ditt företag på några minuter. Enkelt, prisvärt och anpassat för småföretag.", sort_order: 3, is_active: true },
  ],
  benefits: [
    { id: "published-benefit-01", title: "Ingen bindningstid", body: "Avsluta när som helst.", sort_order: 1, is_active: true },
    { id: "published-benefit-02", title: "Kostnadsfri provperiod", body: "Tre veckor utan kostnad.", sort_order: 2, is_active: true },
    { id: "published-benefit-03", title: "Alla HDMI-skärmar", body: "Smart TV och professionell signage.", sort_order: 3, is_active: true },
    { id: "published-benefit-04", title: "100 % nöjdhetsgaranti", body: "Trygg start med Screenia.", sort_order: 4, is_active: true },
  ],
};

async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.app_metadata?.role === "admin" ? user : null;
}

function text(value: unknown, maximum: number) {
  return String(value || "").trim().slice(0, maximum);
}

function getTable(kind: ContentKind) {
  return kind === "slide" ? "landing_hero_slides" : "landing_hero_benefits";
}

function getHighlightTerms(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((term) => text(term, 80)).filter(Boolean).slice(0, 12);
  }

  return String(value || "")
    .split(",")
    .map((term) => text(term, 80))
    .filter(Boolean)
    .slice(0, 12);
}

async function loadContent() {
  const [slides, benefits] = await Promise.all([
    supabaseAdmin.from("landing_hero_slides").select("*").order("sort_order").order("created_at"),
    supabaseAdmin.from("landing_hero_benefits").select("*").order("sort_order").order("created_at"),
  ]);
  return { slides, benefits };
}

async function ensurePublishedFallback() {
  const { count: slideCount, error: slideCountError } = await supabaseAdmin
    .from("landing_hero_slides")
    .select("id", { count: "exact", head: true });
  const { count: benefitCount, error: benefitCountError } = await supabaseAdmin
    .from("landing_hero_benefits")
    .select("id", { count: "exact", head: true });

  if (slideCountError || benefitCountError) return false;

  const inserts = [];
  if ((slideCount || 0) === 0) inserts.push(supabaseAdmin.from("landing_hero_slides").insert(publishedFallback.slides));
  if ((benefitCount || 0) === 0) inserts.push(supabaseAdmin.from("landing_hero_benefits").insert(publishedFallback.benefits));
  if (!inserts.length) return true;

  const results = await Promise.all(inserts);
  return results.every((result) => !result.error);
}

export async function GET() {
  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { slides, benefits } = await loadContent();
  if (slides.error || benefits.error) {
    console.error("Could not load landing content", { slides: slides.error, benefits: benefits.error });
    return NextResponse.json({
      ...publishedFallback,
      migrationRequired: true,
    });
  }
  if (!(slides.data || []).length && !(benefits.data || []).length) {
    await ensurePublishedFallback();
    const seeded = await loadContent();
    if (!seeded.slides.error && !seeded.benefits.error) {
      return NextResponse.json({ slides: seeded.slides.data || [], benefits: seeded.benefits.data || [], migrationRequired: false });
    }
  }
  return NextResponse.json({ slides: slides.data || [], benefits: benefits.data || [], migrationRequired: false });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind as ContentKind;
  const action = body.action as ContentAction;
  const id = text(body.id, 100);

  if (!(["slide", "benefit"] as const).includes(kind) || !(["create", "update", "delete", "move"] as const).includes(action)) {
    return NextResponse.json({ error: "Invalid landing content operation." }, { status: 400 });
  }

  const table = getTable(kind);
  const { data: current, error: currentError } = id
    ? await supabaseAdmin.from(table).select("*").eq("id", id).maybeSingle()
    : { data: null, error: null };
  if (currentError) return NextResponse.json({ error: "Could not read the current content item." }, { status: 500 });
  if (id && !current) return NextResponse.json({ error: "Content item was not found." }, { status: 404 });

  if (action === "create" || action === "update") {
    const title = text(body.title, kind === "slide" ? 220 : 120);
    const contentBody = text(body.body, kind === "slide" ? 1000 : 280);
    const isActive = Boolean(body.isActive);
    const imageUrl = kind === "slide" ? text(body.imageUrl, 2000) : "";
    const highlightTerms = kind === "slide" ? getHighlightTerms(body.highlightTerms) : [];
    if (!title || (kind === "slide" && !imageUrl)) {
      return NextResponse.json({ error: "A title and slide image are required." }, { status: 400 });
    }

    let result;
    if (action === "create") {
      const { data: lastItem } = await supabaseAdmin
        .from(table)
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const record = kind === "slide"
        ? { title, body: contentBody, image_url: imageUrl, highlight_terms: highlightTerms, is_active: isActive, sort_order: (lastItem?.sort_order || 0) + 1 }
        : { title, body: contentBody, is_active: isActive, sort_order: (lastItem?.sort_order || 0) + 1 };
      result = await supabaseAdmin.from(table).insert(record).select("*").single();
    } else {
      const record = kind === "slide"
        ? { title, body: contentBody, image_url: imageUrl, highlight_terms: highlightTerms, is_active: isActive }
        : { title, body: contentBody, is_active: isActive };
      result = await supabaseAdmin.from(table).update(record).eq("id", id).select("*").single();
    }
    if (result.error || !result.data) {
      console.error("Landing content save error", result.error);
      return NextResponse.json({ error: "Could not save the content item." }, { status: 500 });
    }
    await recordAuditEvent(supabaseAdmin, {
      actorType: "admin", actorId: user.id,
      eventType: action === "create" ? `landing_${kind}_created` : `landing_${kind}_updated`,
      eventDescription: `Admin ${action === "create" ? "created" : "updated"} landing ${kind} content.`,
      metadata: { kind, itemId: result.data.id, before: current, after: result.data },
      ipAddress: getRequestIp(request), userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ item: result.data });
  }

  if (action === "delete") {
    const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Could not delete the content item." }, { status: 500 });
    await recordAuditEvent(supabaseAdmin, {
      actorType: "admin", actorId: user.id, eventType: `landing_${kind}_deleted`,
      eventDescription: `Admin deleted landing ${kind} content.`,
      metadata: { kind, itemId: id, before: current },
      ipAddress: getRequestIp(request), userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  }

  const direction = body.direction === "up" ? "up" : body.direction === "down" ? "down" : null;
  if (!direction || !current) return NextResponse.json({ error: "Choose a valid move direction." }, { status: 400 });
  const query = supabaseAdmin.from(table).select("*");
  const { data: neighbour, error: neighbourError } = direction === "up"
    ? await query.lt("sort_order", current.sort_order).order("sort_order", { ascending: false }).limit(1).maybeSingle()
    : await query.gt("sort_order", current.sort_order).order("sort_order", { ascending: true }).limit(1).maybeSingle();
  if (neighbourError) return NextResponse.json({ error: "Could not reorder the content item." }, { status: 500 });
  if (!neighbour) return NextResponse.json({ ok: true });
  const updates = await Promise.all([
    supabaseAdmin.from(table).update({ sort_order: neighbour.sort_order }).eq("id", current.id),
    supabaseAdmin.from(table).update({ sort_order: current.sort_order }).eq("id", neighbour.id),
  ]);
  if (updates.some((result) => result.error)) return NextResponse.json({ error: "Could not reorder the content item." }, { status: 500 });
  await recordAuditEvent(supabaseAdmin, {
    actorType: "admin", actorId: user.id, eventType: `landing_${kind}_reordered`,
    eventDescription: `Admin reordered landing ${kind} content.`,
    metadata: { kind, itemId: id, direction, swappedWith: neighbour.id },
    ipAddress: getRequestIp(request), userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true });
}
