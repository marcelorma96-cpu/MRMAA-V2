import type { StoreProvider } from './store-catalog';

// The verified purchase provider decides where to manage a subscription.
// These destinations contain no session, purchase token, or payment credentials.
export const WEB_SUBSCRIPTION_URL = 'https://www.unomesa.com/login?billing=manage';
const destinations = {
  lemon_squeezy: WEB_SUBSCRIPTION_URL,
  apple: 'https://apps.apple.com/account/subscriptions',
  google_play: 'https://play.google.com/store/account/subscriptions',
} as const;

export function subscriptionManagement(provider: string | null, native: StoreProvider | null) {
  if (provider !== 'lemon_squeezy' && provider !== 'apple' && provider !== 'google_play') return null;
  if (native && provider === native) return { kind: 'native' as const, provider };
  return { kind: 'link' as const, provider, href: destinations[provider] };
}
