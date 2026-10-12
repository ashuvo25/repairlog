import type { RenderedEmail } from "./templates";

// Until a sending domain is verified in Resend, its shared test sender is
// used. Resend then only delivers to the email address of the Resend account.
const DEFAULT_FROM = "RepairLog <onboarding@resend.dev>";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(
  to: string,
  email: RenderedEmail,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "Email is not configured." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(process.env.SUPPORT_EMAIL ? { reply_to: process.env.SUPPORT_EMAIL } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const result = (await response.json()) as { id?: string; message?: string };

    if (!response.ok || !result.id) {
      return { ok: false, error: result.message ?? `Resend returned ${response.status}` };
    }

    return { ok: true, id: result.id };
  } catch {
    return { ok: false, error: "The email service could not be reached." };
  }
}
