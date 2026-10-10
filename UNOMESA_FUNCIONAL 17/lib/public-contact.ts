import { isPossiblePhoneNumber } from 'libphonenumber-js/min';

/** Official number, username and Business chat links. Preserve the destination and message; upgrade HTTP to HTTPS. */
export function officialWhatsAppLink(value: string): string {
  const raw = value.trim();
  if (!raw || raw.length > 2048 || /[\s<>\u0000-\u001f\u007f]/.test(raw)) return '';
  try {
    const url = new URL(/^(wa\.me|api\.whatsapp\.com)\//i.test(raw) ? `https://${raw}` : raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || url.hash) return '';
    url.protocol = 'https:';
    const business = /^\/message\/[A-Za-z0-9_-]{4,128}\/?$/.test(url.pathname);
    const number = /^\/[1-9]\d{7,14}\/?$/.test(url.pathname);
    const username = /^\/[A-Za-z0-9_][A-Za-z0-9._-]{0,127}\/?$/.test(url.pathname) && /[A-Za-z_]/.test(url.pathname);
    if (url.hostname === 'wa.me' && (business || number || username)) return url.href;
    if (url.hostname === 'api.whatsapp.com' && (business || /^\/send\/?$/.test(url.pathname) && /^[1-9]\d{7,14}$/.test((url.searchParams.get('phone') || '').replace(/^\+/, '')))) return url.href;
  } catch {}
  return '';
}

/** Accept a full international number or the official click-to-chat link. Never guess the country. */
export function whatsappNumber(value: string): string {
  let raw = value.trim();
  if (/^(?:https:\/\/)?(?:wa\.me|api\.whatsapp\.com)\//i.test(raw)) {
    try {
      const url = new URL(/^https:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (url.username || url.password || url.port) return '';
      raw = url.hostname === 'wa.me' ? url.pathname.slice(1).replace(/\/$/, '') : url.pathname === '/send' ? url.searchParams.get('phone') || '' : '';
    } catch { return ''; }
  }
  const digits = raw.replace(/[+\s().\-\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/^00/, '');
  return /^[1-9]\d{7,14}$/.test(digits) && isPossiblePhoneNumber(`+${digits}`) ? digits : '';
}

/** Native navigation delegates handle contacts and PDFs; browsers keep the original page open. */
export function nativeContactTarget(native: boolean, url: string) { return !native && (url.startsWith('https://') || url.startsWith('/')) ? '_blank' as const : undefined; }
