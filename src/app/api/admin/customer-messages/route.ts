import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthenticatedUser() {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();

  if (user?.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");

  if (!customerId) {
    return NextResponse.json(
      { error: "Customer ID is required." },
      { status: 400 },
    );
  }

  const { data: messages, error } = await supabaseAdmin
    .from("customer_messages")
    .select(
      "id, subject, message, status, created_at, customer_message_files(id, file_name, content_type, file_size, storage_bucket, storage_path)",
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load customer messages error:", error);
    return NextResponse.json(
      { error: "Could not load customer messages." },
      { status: 500 },
    );
  }

  const messagesWithFiles = await Promise.all(
    (messages || []).map(async (message) => {
      const files = await Promise.all(
        (message.customer_message_files || []).map(async (file) => {
          const { data } = await supabaseAdmin.storage
            .from(file.storage_bucket)
            .createSignedUrl(file.storage_path, 60 * 15);

          return {
            id: file.id,
            fileName: file.file_name,
            contentType: file.content_type,
            fileSize: file.file_size,
            downloadUrl: data?.signedUrl || null,
          };
        }),
      );

      return {
        id: message.id,
        subject: message.subject,
        message: message.message,
        status: message.status,
        createdAt: message.created_at,
        files,
      };
    }),
  );

  return NextResponse.json({ messages: messagesWithFiles });
}
