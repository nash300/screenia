export type DisplayListItem = {
  id: string;
  name: string | null;
  device_code: string;
  location: string | null;
  is_active: boolean | null;
  customers: {
    name: string | null;
    status: string | null;
  } | null;
  playlists: { count: number }[];
};

export type PlaylistItem = {
  id: string;
  src: string;
  order_index: number;
};

export type DisplayDetails = {
  id: string;
  customer_id: string;
  name: string | null;
  is_active: boolean | null;
  location: string | null;
  internal_notes: string | null;
};

export type DisplaySection =
  | "overview"
  | "details"
  | "preview"
  | "media"
  | "display";

export type DisplayOperation = "status" | "delete";

export type DisplayOperationDraft = {
  operation: DisplayOperation;
  reason: string;
  confirmed: boolean;
};
