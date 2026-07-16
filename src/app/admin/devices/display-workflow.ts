import type { DisplaySection } from "./types";

export const displayFilters = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "needs_playlist", label: "Needs playlist" },
];

export const displaySectionIds: DisplaySection[] = [
  "overview",
  "details",
  "preview",
  "media",
  "display",
];

export function displaySections(mediaCount: number): Array<{
  id: DisplaySection;
  label: string;
  count?: number;
}> {
  return [
    { id: "overview", label: "Overview" },
    { id: "details", label: "Details" },
    { id: "preview", label: "Preview" },
    { id: "media", label: "Media", count: mediaCount },
    { id: "display", label: "Display URL" },
  ];
}
