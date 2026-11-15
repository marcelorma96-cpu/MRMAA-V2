/** Used only with a subscription fetched and identity-checked by the server. */
export function lemonSubscriptionEnded(subscription: { status?: unknown; cancelled?: unknown; ends_at?: unknown }, now = Date.now()) {
 if (subscription.status === "expired") return true;
 return subscription.status === "cancelled" && subscription.cancelled === true
  && typeof subscription.ends_at === "string" && Number.isFinite(Date.parse(subscription.ends_at))
  && Date.parse(subscription.ends_at) <= now;
}
