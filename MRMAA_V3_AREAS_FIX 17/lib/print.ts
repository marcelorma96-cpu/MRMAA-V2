import { currentAppLanguage } from "@/components/app-preferences";
import { translateMarkup } from "@/lib/translations";

/** Reserve a visible PDF viewer during the user's click, before any awaits. */
export function reserveQuotePrintWindow(title: string, loading: string): Window | null {
  let target: Window | null = null;
  try {
    target = window.open("", "_blank");
    if (!target) return null;
    target.opener = null;
    target.document.title = title;
    const message = target.document.createElement("p");
    message.textContent = loading;
    message.style.cssText = "font:16px system-ui;padding:24px;color:#18181b";
    target.document.body.appendChild(message);
    return target;
  } catch { target?.close(); return null; }
}

/** Open the PDF itself: A4/Letter selection can scale pages but cannot reflow
 * their rows, numbers or headers. The viewer owns the print dialog. */
export function openQuotePrintDocument(blob: Blob, target: Window | null) {
  if (blob.type !== "application/pdf" || !blob.size) throw new Error("No se pudo preparar el documento.");
  const url = URL.createObjectURL(blob);
  let opened = false;
  if (target && !target.closed) {
    try { target.location.replace(url); opened = true; }
    catch { target.close(); }
  }
  if (opened && target) {
    // Keep the PDF alive as long as its viewer. Do not revoke it on afterprint:
    // cancelling or printing again must leave a usable document.
    const timer = setInterval(() => {
      if (target.closed) { clearInterval(timer); URL.revokeObjectURL(url); }
    }, 5000);
  }
  // If popups were blocked, the caller shows a normal link and owns its URL.
  return { url, opened };
}

export function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return frame.remove();
  doc.open();
  doc.write(translateMarkup(html, currentAppLanguage()));
  doc.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  }, 150);
}
