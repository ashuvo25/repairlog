import { NextResponse } from "next/server";

import { isUuid } from "@/lib/modules/equipment/validation";
import {
  MAX_PHOTOS,
  MAX_UPLOAD_BYTES,
  processPhoto,
} from "@/lib/modules/public-reports/server";
import { getCurrentMembership } from "@/lib/permissions/current-membership";
import { createAdminClient } from "@/lib/supabase/admin/client";
import { createClient } from "@/lib/supabase/server/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "repair-photos";

function reply(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

// Adds a photo to a ticket for a signed-in team member. Storage writes use
// the service role, so every check happens here before anything is written.
export async function POST(request: Request) {
  const membership = await getCurrentMembership().catch(() => null);
  if (!membership) {
    return reply(401, "Sign in required.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return reply(413, "Photo is too large.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, "Invalid upload.");
  }

  const ticketId = form.get("ticketId")?.toString() ?? "";
  const file = form.get("photo");

  if (!isUuid(ticketId) || !(file instanceof File)) {
    return reply(400, "Invalid upload.");
  }

  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    return reply(413, "Photo is too large.");
  }

  // Read through the member's own session: row-level security confirms the
  // ticket belongs to their café.
  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, status")
    .eq("organization_id", membership.organizationId)
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return reply(404, "Ticket not found.");
  }

  if (ticket.status === "resolved") {
    return reply(409, "This ticket is resolved.");
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("attachments")
    .select("photo_slot")
    .eq("organization_id", membership.organizationId)
    .eq("ticket_id", ticketId);

  if (existingError) {
    return reply(500, "Upload failed.");
  }

  const used = new Set(
    ((existing ?? []) as { photo_slot: number }[]).map((row) => row.photo_slot),
  );
  const slot = [1, 2].find((candidate) => !used.has(candidate));

  if (!slot || used.size >= MAX_PHOTOS) {
    return reply(409, "This ticket already has two photos.");
  }

  const photo = await processPhoto(Buffer.from(await file.arrayBuffer()));
  if (!photo) {
    return reply(415, "This file is not a supported photo.");
  }

  const storagePath = `${membership.organizationId}/tickets/${ticketId}/${slot}-${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, photo.data, { contentType: "image/jpeg", upsert: false });

  if (uploadError) {
    console.error("Ticket photo upload failed", { message: uploadError.message });
    return reply(500, "Upload failed.");
  }

  const { error: insertError } = await admin.from("attachments").insert({
    organization_id: membership.organizationId,
    ticket_id: ticketId,
    uploaded_by: membership.userId,
    photo_slot: slot,
    storage_path: storagePath,
    size_bytes: photo.data.byteLength,
    media_type: "image/jpeg",
    width: photo.width,
    height: photo.height,
    upload_state: "ready",
  });

  if (insertError) {
    // Another upload took this slot at the same moment; remove the orphan.
    await admin.storage.from(BUCKET).remove([storagePath]);
    return reply(
      insertError.code === "23505" ? 409 : 500,
      insertError.code === "23505" ? "Try again in a moment." : "Upload failed.",
    );
  }

  return reply(201, "Photo attached.");
}
