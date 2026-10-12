// Email templates. Plain functions with no imports so they can be rendered
// anywhere (server actions, scripts, tests). Tables and inline styles keep
// them readable in Gmail, Outlook and Apple Mail.

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

const COLORS = {
  page: "#f8f5f0",
  card: "#ffffff",
  text: "#2b2420",
  muted: "#6b6058",
  border: "#e7e0d7",
  button: "#3e2c23",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout({
  preheader,
  heading,
  body,
  button,
  footnote,
}: {
  preheader: string;
  heading: string;
  body: string;
  button?: { label: string; url: string };
  footnote: string;
}) {
  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">
        <tr><td style="border-radius:6px;background:${COLORS.button}">
          <a href="${escapeHtml(button.url)}" style="display:inline-block;padding:14px 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(button.label)}</a>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${COLORS.muted}">
        If the button doesn't work, copy this link into your browser:<br>
        <a href="${escapeHtml(button.url)}" style="color:${COLORS.text};word-break:break-all">${escapeHtml(button.url)}</a>
      </p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
      <tr><td style="padding:0 4px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:32px;height:32px;border-radius:8px;background:${COLORS.button};text-align:center;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff">R</td>
          <td style="padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:${COLORS.text}">RepairLog</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:10px;padding:32px 28px">
        <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:32px;color:${COLORS.text}">${escapeHtml(heading)}</h1>
        ${body}
        ${buttonHtml}
      </td></tr>
      <tr><td style="padding:20px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${COLORS.muted}">
        ${footnote}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function paragraph(html: string) {
  return `<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${COLORS.text}">${html}</p>`;
}

export function invitationEmail({
  cafeName,
  inviterEmail,
  inviteUrl,
  inviteeEmail,
  expiresOn,
}: {
  cafeName: string;
  inviterEmail: string | null;
  inviteUrl: string;
  inviteeEmail: string;
  expiresOn: string;
}): RenderedEmail {
  const cafe = escapeHtml(cafeName);
  const inviter = inviterEmail ? escapeHtml(inviterEmail) : "The café owner";
  const invitee = escapeHtml(inviteeEmail);

  const html = layout({
    preheader: `Join ${cafeName} on RepairLog to report and follow equipment repairs.`,
    heading: `Join ${cafeName} on RepairLog`,
    body:
      paragraph(`${inviter} invited you to the <strong>${cafe}</strong> team on RepairLog.`) +
      paragraph(
        "RepairLog is where your café tracks broken equipment: you can report a fault, follow the repair, and see which menu items are off today.",
      ) +
      paragraph(
        `Sign in with the Google account <strong>${invitee}</strong>. The invitation only works for that account.`,
      ),
    button: { label: `Join ${cafeName}`, url: inviteUrl },
    footnote: `This invitation can be used once and expires on ${escapeHtml(expiresOn)}. If you weren't expecting it, you can ignore this email.`,
  });

  const text = [
    `Join ${cafeName} on RepairLog`,
    "",
    `${inviterEmail ?? "The café owner"} invited you to the ${cafeName} team on RepairLog.`,
    "RepairLog is where your café tracks broken equipment: report a fault, follow the repair, and see which menu items are off today.",
    "",
    `Sign in with the Google account ${inviteeEmail}. The invitation only works for that account.`,
    "",
    `Join here: ${inviteUrl}`,
    "",
    `This invitation can be used once and expires on ${expiresOn}. If you weren't expecting it, you can ignore this email.`,
  ].join("\n");

  return { subject: `You're invited to join ${cafeName} on RepairLog`, html, text };
}
