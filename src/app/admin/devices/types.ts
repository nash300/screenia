export type DisplayListItem = {
  id: string;
  name: string | null;
  device_code: string;
  serial_number: string | null;
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
  make: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_cost: number | null;
  purchase_date: string | null;
  warranty_period_months: number | null;
  supplier: string | null;
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
