import type { User } from "@supabase/supabase-js";

export const PASSWORD_MAX_LENGTH = 128;
export function passwordIsStrong(value: string) {
  return value.length >= 8 && value.length <= PASSWORD_MAX_LENGTH && /[a-z]/.test(value)
    && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

// Presentation only: neither this hint nor editable metadata authorizes a change.
// Supabase owns password validation and the actual credential state.
export function passwordAction(user: User, passwordLogin = false): "create" | "change" {
  const google = user.identities?.some(identity => identity.provider === "google");
  const email = user.identities?.some(identity => identity.provider === "email");
  return google && !email && !passwordLogin && user.user_metadata?.unomesa_password_set !== true
    ? "create" : "change";
}
