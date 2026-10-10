import { isPossiblePhoneNumber } from 'libphonenumber-js/min';

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

/** Called synchronously on a user gesture; native iOS already hands HTTPS contacts to the system. */
export function openPublicContact(url: string): boolean {
  if (!/^https:\/\/wa\.me\/[1-9]\d{7,14}\?text=/.test(url) && !/^mailto:/.test(url) && !/^tel:\+[1-9]\d{7,14}$/.test(url)) return false;
  if (/UnoMesa-(iOS|Android)\//.test(navigator.userAgent)) { window.location.assign(url); return true; }
  if (!url.startsWith('https://')) { window.location.assign(url); return true; }
  const tab = window.open('about:blank', '_blank');
  if (!tab) return false;
  tab.opener = null;
  tab.location.replace(url);
  return true;
}
