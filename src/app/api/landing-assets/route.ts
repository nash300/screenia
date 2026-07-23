import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const publicRoot = path.join(process.cwd(), "public");
const heroSlideDirectory = path.join(publicRoot, "landing", "hero-slides");
const serviceLogoDirectory = path.join(publicRoot, "landing", "service-logos");

const videoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const logoExtensions = new Set([".png"]);

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
);

const toLabel = (fileName: string) => {
  const parsed = path.parse(fileName).name;

  return parsed
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const getPngDimensions = async (filePath: string) => {
  try {
    const file = await readFile(filePath);
    const isPng =
      file.length >= 24 &&
      file[0] === 0x89 &&
      file[1] === 0x50 &&
      file[2] === 0x4e &&
      file[3] === 0x47;

    if (!isPng) return null;

    return {
      width: file.readUInt32BE(16),
      height: file.readUInt32BE(20),
    };
  } catch {
    return null;
  }
};

const listPublicFiles = async (
  directory: string,
  publicPath: string,
  extensions: Set<string>,
) => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });

    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => extensions.has(path.extname(fileName).toLowerCase()))
      .sort((first, second) => first.localeCompare(second, "sv"));

    return Promise.all(files.map(async (fileName) => {
      const dimensions = await getPngDimensions(path.join(directory, fileName));

      return {
        label: toLabel(fileName),
        src: `${publicPath}/${encodeURIComponent(fileName)}`,
        width: dimensions?.width,
        height: dimensions?.height,
      };
    }));
  } catch {
    return [];
  }
};

type HeroSlideText = {
  id?: string;
  image?: string;
  media?: string;
  label?: string;
  sv?: {
    eyebrow?: string;
    title?: string;
    text?: string;
  };
  en?: {
    eyebrow?: string;
    title?: string;
    text?: string;
  };
};

type HeroSlideManifest = {
  slides?: HeroSlideText[];
};

const getMediaType = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();

  if (videoExtensions.has(extension)) return "video";
  if (imageExtensions.has(extension)) return "image";

  return null;
};

const publicHeroPath = (filePath: string) =>
  `/landing/hero-slides/${filePath
    .split(/[\\/]+/)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;

const listHeroSlidesFromManifest = async () => {
  try {
    const rawManifest = await readFile(
      path.join(heroSlideDirectory, "slides.json"),
      "utf8",
    );
    const manifest = JSON.parse(rawManifest) as HeroSlideManifest;

    if (!manifest.slides?.length) return [];

    return manifest.slides
      .map((slide, index) => {
        const mediaFile = slide.image || slide.media;
        if (!mediaFile) return null;

        const mediaType = getMediaType(mediaFile);
        if (!mediaType) return null;

        const id = slide.id || path.parse(mediaFile).name || String(index + 1);

        return {
          id,
          label: slide.label || toLabel(id),
          src: publicHeroPath(mediaFile),
          mediaType,
          sv: {
            eyebrow: slide.sv?.eyebrow ?? "Digital skyltning för företag",
            title: slide.sv?.title || toLabel(id),
            text: slide.sv?.text || "",
          },
          en: {
            eyebrow: slide.en?.eyebrow ?? "Digital signage for businesses",
            title: slide.en?.title || toLabel(id),
            text: slide.en?.text || "",
          },
        };
      })
      .filter((slide) => slide !== null);
  } catch {
    return [];
  }
};

const listHeroSlides = async () => {
  const manifestSlides = await listHeroSlidesFromManifest();
  if (manifestSlides.length > 0) return manifestSlides;

  try {
    const entries = await readdir(heroSlideDirectory, { withFileTypes: true });
    const slideDirectories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((first, second) => first.localeCompare(second, "sv"));

    const slides = await Promise.all(
      slideDirectories.map(async (directoryName) => {
        try {
          const slidePath = path.join(heroSlideDirectory, directoryName);
          const files = await readdir(slidePath, { withFileTypes: true });
          const mediaFile = files
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .sort((first, second) => first.localeCompare(second, "sv"))
            .find((fileName) => getMediaType(fileName));

          if (!mediaFile) return null;

          const rawText = await readFile(path.join(slidePath, "slide.json"), "utf8");
          const text = JSON.parse(rawText) as HeroSlideText;
          const publicPath = `/landing/hero-slides/${encodeURIComponent(directoryName)}/${encodeURIComponent(mediaFile)}`;

          return {
            id: directoryName,
            label: toLabel(directoryName),
            src: publicPath,
            mediaType: getMediaType(mediaFile),
            sv: {
              eyebrow: text.sv?.eyebrow ?? "Digital skyltning för företag",
              title: text.sv?.title || toLabel(directoryName),
              text: text.sv?.text || "",
            },
            en: {
              eyebrow: text.en?.eyebrow ?? "Digital signage for businesses",
              title: text.en?.title || toLabel(directoryName),
              text: text.en?.text || "",
            },
          };
        } catch {
          return null;
        }
      }),
    );

    return slides.filter((slide) => slide !== null);
  } catch {
    return [];
  }
};

const listManagedHeroContent = async () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { heroSlides: [], heroBenefits: [] };
  }

  const [slides, benefits] = await Promise.all([
    supabaseAdmin.from("landing_hero_slides").select("id, image_url, title, body, highlight_terms").eq("is_active", true).order("sort_order").order("created_at"),
    supabaseAdmin.from("landing_hero_benefits").select("id, title, body").eq("is_active", true).order("sort_order").order("created_at"),
  ]);

  if (slides.error || benefits.error) return { heroSlides: [], heroBenefits: [] };

  return {
    heroSlides: (slides.data || []).map((slide) => ({
      id: slide.id,
      label: slide.title,
      src: slide.image_url,
      highlightTerms: Array.isArray(slide.highlight_terms) ? slide.highlight_terms : [],
      mediaType: "image" as const,
      sv: { eyebrow: "", title: slide.title, text: slide.body || "" },
      en: { eyebrow: "", title: slide.title, text: slide.body || "" },
    })),
    heroBenefits: (benefits.data || []).map((benefit) => ({
      id: benefit.id,
      title: benefit.title,
      body: benefit.body || "",
    })),
  };
};

export async function GET() {
  const [managedContent, fileHeroSlides, serviceLogos] = await Promise.all([
    listManagedHeroContent(),
    listHeroSlides(),
    listPublicFiles(serviceLogoDirectory, "/landing/service-logos", logoExtensions),
  ]);

  return NextResponse.json(
    {
      heroSlides: managedContent.heroSlides.length ? managedContent.heroSlides : fileHeroSlides,
      heroBenefits: managedContent.heroBenefits,
      serviceLogos,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
