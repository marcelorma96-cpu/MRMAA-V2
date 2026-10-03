import { siteOrigin } from "./site-origin";

/** New-brand senders only. SMTP credentials remain separately configurable. */
export function mailSender(kind: "passcode" | "support") {
  const expected = kind === "passcode" ? "passcode@unomesa.com" : "support@unomesa.com";
  const configured = (kind === "passcode" ? process.env.UNOMESA_PASSCODE_FROM : process.env.UNOMESA_SUPPORT_FROM)?.trim();
  if (!configured) return `UnoMesa <${expected}>`;
  const address = (configured.match(/<([^<>]+)>$/)?.[1] || configured).trim().toLowerCase();
  if (address !== expected) throw new Error("EMAIL_CONFIG");
  return configured;
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));

/** Keep the complete plain-text message, codes and links as a mail-client fallback. */
export function brandMail<T extends { text: string }>(message: T) {
  let origin = "";
  try { origin = siteOrigin(); } catch { /* A missing brand image must never block a security email. */ }
  const header = origin
    ? `<img src="${escapeHtml(origin)}/brand/unomesa-logo.png" alt="UnoMesa" width="240" style="display:block;width:240px;max-width:100%;height:auto;border:0" />`
    : '<strong style="font-size:24px;color:#252525">UnoMesa</strong>';
  const body = message.text.split(/(https?:\/\/[^\s<>"']+)/g).map(part =>
    /^https?:\/\//.test(part) ? `<a href="${escapeHtml(part)}" style="color:#a83d00;text-decoration:underline;overflow-wrap:anywhere">${escapeHtml(part)}</a>` : escapeHtml(part)
  ).join("").replace(/\n/g, "<br />");
  return { ...message, html: `<html><body style="margin:0;background:#f5f5f4;color:#252525"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#ffffff;color:#252525;border-radius:16px"><tr><td style="padding:24px 28px;border-bottom:3px solid #f56600;background:#ffffff;color:#252525">${header}</td></tr><tr><td style="padding:28px;font:16px/1.6 Arial,sans-serif;color:#252525;background:#ffffff"><div style="white-space:pre-line;overflow-wrap:anywhere">${body}</div></td></tr></table></td></tr></table></body></html>` };
}
