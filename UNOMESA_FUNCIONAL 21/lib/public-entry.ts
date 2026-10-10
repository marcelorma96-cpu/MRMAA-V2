/** Only route selection lives here. All account screens still pass the MFA gate. */
export type PublicEntry = "landing" | "login" | "signup";
export function requestedAccountEntry(search: string, hash = ""): PublicEntry | null {
  const params = new URLSearchParams(search), fragment = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.get("login") === "1") return "login";
  if (params.get("signup") === "1") return "signup";
  if (["invite", "invitation", "reset", "support", "billing", "code", "error"].some(key => params.has(key))
    || ["access_token", "refresh_token", "type", "error"].some(key => fragment.has(key))) return "login";
  return null;
}
