"use server";

import { headers } from "next/headers";

import { isUuid } from "@/lib/modules/equipment/validation";
import {
  getReporterFingerprint,
  MAX_DESCRIPTION_LENGTH,
  verifyTurnstile,
} from "@/lib/modules/public-reports/server";
import { createAdminClient } from "@/lib/supabase/admin/client";

export type SubmitReportState = {
  error?: string;
  // Present once the text report is safely stored.
  report?: { id: string; uploadToken: string };
};

const GENERIC_ERROR =
  "We could not send your report. Please try again, or tell a member of staff.";

export async function submitPublicReport(
  _state: SubmitReportState,
  formData: FormData,
): Promise<SubmitReportState> {
  const code = formData.get("code")?.toString() ?? "";
  const requestId = formData.get("requestId")?.toString() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";

  // Real visitors never see or fill this field; simple bots do.
  if (formData.get("website")?.toString()) {
    return { error: GENERIC_ERROR };
  }

  if (!isUuid(code) || !isUuid(requestId)) {
    return { error: "This report page is out of date. Scan the QR code again." };
  }

  if (description.length < 1) {
    return { error: "Describe the problem before sending." };
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      error: `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`,
    };
  }

  const turnstileToken = formData.get("cf-turnstile-response")?.toString() ?? null;
  if (!(await verifyTurnstile(turnstileToken))) {
    return { error: "Please complete the security check and try again." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("submit_public_report", {
    p_public_report_code: code,
    p_request_id: requestId,
    p_description: description,
    p_fingerprint: getReporterFingerprint(await headers()),
  });

  if (error) {
    if (error.code === "RL020") {
      return {
        error:
          "Too many reports were sent recently. Please tell a member of staff instead.",
      };
    }

    if (error.code === "RL021") {
      return {
        error:
          "This café cannot take more online reports right now. Please tell a member of staff.",
      };
    }

    if (error.code === "P0002") {
      return {
        error: "This QR code is no longer active. Please tell a member of staff.",
      };
    }

    console.error("submit_public_report failed", { code: error.code });
    return { error: GENERIC_ERROR };
  }

  const result = data as { report_id?: unknown; upload_token?: unknown } | null;

  if (
    typeof result?.report_id !== "string" ||
    typeof result.upload_token !== "string"
  ) {
    return { error: GENERIC_ERROR };
  }

  return { report: { id: result.report_id, uploadToken: result.upload_token } };
}
