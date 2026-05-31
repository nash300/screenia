import type { SupabaseClient } from "@supabase/supabase-js";

export const DISPLAY_ASSET_BUCKET = "customer-display-assets";
export const MAX_DISPLAY_FILES = 8;
export const MAX_DISPLAY_TOTAL_BYTES = 15 * 1024 * 1024;
export const MAX_DISPLAY_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_DISPLAY_DESCRIPTION_LENGTH = 1200;

export const DISPLAY_ASSET_CATEGORIES = [
  "logo",
  "image",
  "menu",
  "text",
  "other",
] as const;

export type DisplayAssetCategory = (typeof DISPLAY_ASSET_CATEGORIES)[number];

export type DisplayFileInput = {
  name?: string;
  type?: string;
  size?: number;
  data?: string;
  category?: string;
  description?: string;
};

const ALLOWED_DISPLAY_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function decodeBase64File(file: DisplayFileInput) {
  const base64 = String(file.data || "").split(",").pop() || "";
  return Buffer.from(base64, "base64");
}

function normalizeCategory(category: string | undefined): DisplayAssetCategory {
  const value = String(category || "other").trim();
  return DISPLAY_ASSET_CATEGORIES.includes(value as DisplayAssetCategory)
    ? (value as DisplayAssetCategory)
    : "other";
}

export function validateDisplayAssetRequest(
  files: DisplayFileInput[],
  description: string,
) {
  const cleanDescription = description.trim();

  if (cleanDescription.length > MAX_DISPLAY_DESCRIPTION_LENGTH) {
    return {
      error: `Beskrivningen får vara högst ${MAX_DISPLAY_DESCRIPTION_LENGTH} tecken.`,
    };
  }

  if (files.length > MAX_DISPLAY_FILES) {
    return { error: `Du kan ladda upp högst ${MAX_DISPLAY_FILES} filer åt gången.` };
  }

  const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);

  if (totalBytes > MAX_DISPLAY_TOTAL_BYTES) {
    return { error: "Filerna får tillsammans vara högst 15 MB." };
  }

  for (const file of files) {
    const fileName = sanitizeFileName(String(file.name || ""));
    const contentType = String(file.type || "");
    const fileSize = Number(file.size || 0);
    const category = normalizeCategory(file.category);
    const maxBytes =
      category === "logo" ? MAX_LOGO_FILE_BYTES : MAX_DISPLAY_FILE_BYTES;

    if (!fileName) {
      return { error: "En uppladdad fil saknar filnamn." };
    }

    if (!ALLOWED_DISPLAY_FILE_TYPES.has(contentType)) {
      return {
        error: "Endast JPG, PNG, WEBP, HEIC och PDF kan laddas upp.",
      };
    }

    if (fileSize <= 0 || fileSize > maxBytes) {
      const maxMb = Math.round(maxBytes / 1024 / 1024);
      return { error: `${fileName} är för stor. Max ${maxMb} MB.` };
    }
  }

  if (!files.length && !cleanDescription) {
    return {
      error: "Lägg till en beskrivning eller minst en fil innan du fortsätter.",
    };
  }

  return { error: null };
}

export async function saveDisplayAssets({
  supabase,
  customerId,
  files,
  description,
  source,
  uploadedBy = "customer",
}: {
  supabase: SupabaseClient;
  customerId: string;
  files: DisplayFileInput[];
  description: string;
  source: "onboarding" | "account" | "admin";
  uploadedBy?: string;
}) {
  const storedFiles: string[] = [];
  const cleanDescription = description.trim() || null;

  if (!files.length && cleanDescription) {
    const { error } = await supabase.from("customer_display_assets").insert({
      customer_id: customerId,
      asset_category: "text",
      description: cleanDescription,
      source,
      status: "new",
      uploaded_by: uploadedBy,
    });

    if (error) throw error;
    return { storedFiles, descriptionStored: true };
  }

  for (const file of files) {
    const fileName = sanitizeFileName(String(file.name || "display-material"));
    const contentType = String(file.type || "application/octet-stream");
    const category = normalizeCategory(file.category);
    const bytes = decodeBase64File(file);

    if (bytes.byteLength === 0) {
      throw new Error(`${fileName} kunde inte läsas.`);
    }

    const storagePath = `${customerId}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from(DISPLAY_ASSET_BUCKET)
      .upload(storagePath, bytes, {
        contentType,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { error: assetError } = await supabase
      .from("customer_display_assets")
      .insert({
        customer_id: customerId,
        file_name: fileName,
        content_type: contentType,
        file_size: bytes.byteLength,
        storage_bucket: DISPLAY_ASSET_BUCKET,
        storage_path: storagePath,
        uploaded_by: uploadedBy,
        asset_category: category,
        description: String(file.description || "").trim() || cleanDescription,
        source,
        status: "new",
      });

    if (assetError) throw assetError;
    storedFiles.push(fileName);
  }

  return { storedFiles, descriptionStored: Boolean(cleanDescription) };
}
