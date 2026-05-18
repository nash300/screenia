import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const publicRoot = path.join(process.cwd(), "public");
const heroSlideDirectory = path.join(publicRoot, "landing", "hero-slides");
const serviceLogoDirectory = path.join(publicRoot, "landing", "service-logos");

const videoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);
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

const listHeroSlides = async () => {
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
          const videoFile = files
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .find((fileName) => videoExtensions.has(path.extname(fileName).toLowerCase()));

          if (!videoFile) return null;

          const rawText = await readFile(path.join(slidePath, "slide.json"), "utf8");
          const text = JSON.parse(rawText) as HeroSlideText;
          const publicPath = `/landing/hero-slides/${encodeURIComponent(directoryName)}/${encodeURIComponent(videoFile)}`;

          return {
            id: directoryName,
            label: toLabel(directoryName),
            src: publicPath,
            sv: {
              eyebrow: text.sv?.eyebrow || "Digital skyltning for foretag",
              title: text.sv?.title || toLabel(directoryName),
              text: text.sv?.text || "",
            },
            en: {
              eyebrow: text.en?.eyebrow || "Digital signage for businesses",
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
