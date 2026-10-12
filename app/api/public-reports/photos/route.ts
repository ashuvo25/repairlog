import { NextResponse } from "next/server";

import { isUuid } from "@/lib/modules/equipment/validation";
import {
  MAX_PHOTOS,
  MAX_UPLOAD_BYTES,
  processPhoto,
  uploadTokenMatches,
} from "@/lib/modules/public-reports/server";
import { createAdminClient } from "@/lib/supabase/admin/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "repair-photos";

function reply(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

// Attaches one photo to a public report that was just submitted. The upload
// token returned with the report is the only authorization.
export async function POST(request: Request) {
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

  const reportId = form.get("reportId")?.toString() ?? "";
  const token = form.get("uploadToken")?.toString() ?? "";
  const slot = Number(form.get("slot"));
  const file = form.get("photo");

  if (
    !isUuid(reportId) ||
    !Number.isInteger(slot) ||
    slot < 1 ||
    slot > MAX_PHOTOS ||
    !(file instanceof File)
  ) {
    return reply(400, "Invalid upload.");
  }

  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    return reply(413, "Photo is too large.");
  }

  const admin = createAdminClient();
  const { data: report, error: reportError } = await admin
    .from("public_reports")
    .select("id, organization_id, status, upload_token_hash, upload_expires_at")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError) {
    console.error("Public report lookup failed", { code: reportError.code });
    return reply(500, "Upload failed.");
  }

  // One answer for every authorization failure, so nothing can be probed.
  if (
    !report ||
    report.status !== "pending" ||
    new Date(report.upload_expires_at).getTime() < Date.now() ||
    !uploadTokenMatches(token, report.upload_token_hash)
  ) {
    return reply(403, "This upload is not allowed.");
  }

  const photo = await processPhoto(Buffer.from(await file.arrayBuffer()));
  if (!photo) {
    return reply(415, "This file is not a supported photo.");
  }

  const storagePath = `${report.organization_id}/public-reports/${report.id}/${slot}-${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, photo.data, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    console.error("Public report photo upload failed", {
      message: uploadError.message,
    });
    return reply(500, "Upload failed.");
  }

  const { error: insertError } = await admin.from("public_report_photos").insert({
    organization_id: report.organization_id,
    report_id: report.id,
    photo_slot: slot,
    storage_path: storagePath,
    size_bytes: photo.data.byteLength,
    media_type: "image/jpeg",
    width: photo.width,
    height: photo.height,
  });

  if (insertError) {
    // The slot is already filled (a retry) or the record failed: either way
    // the object just stored is not referenced, so remove it.
    await admin.storage.from(BUCKET).remove([storagePath]);

    if (insertError.code === "23505") {
      return reply(200, "Photo already attached.");
    }

    console.error("Public report photo record failed", { code: insertError.code });
    return reply(500, "Upload failed.");
  }

  return reply(201, "Photo attached.");
}
