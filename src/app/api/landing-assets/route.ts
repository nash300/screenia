import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const publicRoot = path.join(process.cwd(), "public");
const heroSlideDirectory = path.join(publicRoot, "landing", "hero-slides");
const serviceLogoDirectory = path.join(publicRoot, "landing", "service-logos");

const videoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const logoExtensions = new Set([".png"]);

export const dynamic = "force-dynamic";

const toLabel = (fileName: string) => {
  const parsed = path.parse(fileName).name;

  return parsed
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const listPublicFiles = async (
  directory: string,
  publicPath: string,
  extensions: Set<string>,
) => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => extensions.has(path.extname(fileName).toLowerCase()))
      .sort((first, second) => first.localeCompare(second, "sv"))
      .map((fileName) => ({
        label: toLabel(fileName),
        src: `${publicPath}/${encodeURIComponent(fileName)}`,
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

export async function GET() {
  const [heroSlides, serviceLogos] = await Promise.all([
    listHeroSlides(),
    listPublicFiles(serviceLogoDirectory, "/landing/service-logos", logoExtensions),
  ]);

  return NextResponse.json(
    {
      heroSlides,
      serviceLogos,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
