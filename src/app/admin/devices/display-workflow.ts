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
  stage: string;
  label: string;
  description: string;
  count?: number;
}> {
  return [
    {
      id: "overview",
      stage: "1",
      label: "Status",
      description: "Display identity and service state",
    },
    {
      id: "details",
      stage: "2",
      label: "Placement",
      description: "Location, notes, and customer context",
    },
    {
      id: "preview",
      stage: "3",
      label: "Live preview",
      description: "Check exactly what the screen shows",
    },
    {
      id: "media",
      stage: "4",
      label: "Playlist",
      description: "Upload and arrange screen content",
      count: mediaCount,
    },
    {
      id: "display",
      stage: "5",
      label: "Install link",
      description: "Open the customer display endpoint",
    },
  ];
}
