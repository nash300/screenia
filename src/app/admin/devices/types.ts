export type DisplayListItem = {
  id: string;
  name: string | null;
  device_code: string;
  location: string | null;
  is_active: boolean | null;
  is_complimentary: boolean | null;
  complimentary_expires_at: string | null;
  replacement_for_device_id: string | null;
  is_loaner: boolean | null;
  loaner_due_at: string | null;
  customers: {
    name: string | null;
    status: string | null;
  } | null;
  playlists: { count: number }[];
};

export type PlaylistItem = {
  id: string;
  src: string;
  content_type: string | null;
  order_index: number;
};

export type DisplayDetails = {
  id: string;
  customer_id: string;
  name: string | null;
  is_active: boolean | null;
  is_complimentary: boolean | null;
  complimentary_expires_at: string | null;
  replacement_for_device_id: string | null;
  is_loaner: boolean | null;
  loaner_due_at: string | null;
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
