export type WhatsAppWindowResult = 'opened' | 'reused' | 'unavailable' | 'blocked';
type ChatWindow = Pick<Window, 'closed' | 'focus' | 'opener'> & {location: {href: string}};
type WindowHost = {open: (url: string, name: string) => ChatWindow | null; wasOpened: () => boolean; remember: () => void};

/** Only handles created by UnoMesa can be reused. Never inspect WhatsApp DOM,
 * account, cookies or tabs. COOP/closed handles need a deliberate user choice. */
export function createWhatsAppWebWindow(host: WindowHost) {
 let target: ChatWindow | null = null;
 let opened = false;
 return (href: string, allowAnother = false): WhatsAppWindowResult => {
  const url = new URL(href);
  if (url.origin !== 'https://web.whatsapp.com' || url.username || url.password || !['/', '/send', '/send/'].includes(url.pathname)) throw new Error('Invalid WhatsApp Web URL');
  if (target) {
   try {
    if (!target.closed) {
     target.location.href = url.href;
     try { target.focus(); } catch { /* Navigation succeeded; never open a duplicate to focus. */ }
     return 'reused';
    }
   } catch { if (!allowAnother) return 'unavailable'; }
  }
  if (!allowAnother && (opened || host.wasOpened())) return 'unavailable';
  try {
   // noopener in windowFeatures would force a new context for a named target.
   // Disown the blank window before navigating to the trusted site.
   target = host.open('', 'UnoMesaWhatsAppWeb');
   if (!target) return 'blocked';
   opened = true; host.remember();
   target.opener = null;
   target.location.href = url.href;
   try { target.focus(); } catch { /* No duplicate. */ }
   return 'opened';
  } catch { return opened ? 'unavailable' : 'blocked'; }
 };
}

let openWeb: ReturnType<typeof createWhatsAppWebWindow> | undefined;
export function openWhatsAppWeb(href: string, allowAnother = false) {
 if (typeof window === 'undefined') return 'blocked' as const;
 if (!openWeb) openWeb = createWhatsAppWebWindow({
  open: (url, name) => window.open(url, name),
  wasOpened: () => { try { return sessionStorage.getItem('unomesa.whatsapp.web.opened') === '1'; } catch { return false; } },
  remember: () => { try { sessionStorage.setItem('unomesa.whatsapp.web.opened', '1'); } catch { /* Memory fallback. */ } },
 });
 return openWeb(href, allowAnother);
}
