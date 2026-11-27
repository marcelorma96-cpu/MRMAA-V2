// A transport failure is not evidence that a session was revoked or that MFA
// failed. These classifications never grant access; a successful check does.
export const SESSION_VERIFICATION_TIMEOUT = 12000;
export const SESSION_RETRY_DELAYS = [1000, 3000, 10000, 30000] as const;
export type VerificationFailure = 'offline' | 'retrying' | 'error';

export function sessionTokenId(token: string): string | null {
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof claims.session_id === 'string' && claims.session_id ? claims.session_id : null;
  } catch { return null; }
}

function errorFields(error: unknown): Record<string, unknown> {
  return error && typeof error === 'object' ? error as Record<string, unknown> : {};
}

export function classifyVerificationFailure(error: unknown, online: boolean): VerificationFailure {
  if (!online) return 'offline';
  const fields = errorFields(error), status = Number(fields.status);
  if (status === 408 || status === 429 || (status >= 500 && status <= 599)) return 'retrying';
  // Authorization/configuration failures must not be described as lost internet.
  if (status >= 400 && status < 500) return 'error';
  if (fields.name === 'AuthRetryableFetchError' || fields.code === 'SESSION_CHECK_TIMEOUT') return 'retrying';
  if (/^PGRST00[0-3]$/.test(String(fields.code || ''))) return 'retrying';
  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(String(fields.message || ''))) return 'retrying';
  return 'error';
}

// Log only a stage and bounded status/code, never tokens, identities, URLs or
// raw server messages. This helps diagnose a repeat without exposing account data.
export function verificationDiagnostic(stage: string, failure: VerificationFailure, error: unknown) {
  const fields = errorFields(error), status = Number(fields.status);
  const code = typeof fields.code === 'string' && /^(PGRST\d{3}|\d{5}|SESSION_CHECK_TIMEOUT|SESSION_INVALID|SESSION_RESPONSE_INVALID)$/.test(fields.code)
    ? fields.code : 'CHECK_FAILED';
  return { stage, failure, code, ...(status >= 100 && status <= 599 ? { status } : {}) };
}

export async function runSessionVerification<T>(controller: AbortController, work: (signal: AbortSignal) => Promise<T>, timeoutMs = SESSION_VERIFICATION_TIMEOUT): Promise<T> {
  const { signal } = controller;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const cancelled = new Promise<never>((_, reject) => {
      onAbort = () => reject(signal.reason || new Error('SESSION_CHECK_CANCELLED'));
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => controller.abort({ code: 'SESSION_CHECK_TIMEOUT' }), timeoutMs);
    });
    return await Promise.race([cancelled, Promise.resolve().then(() => {
      if (signal.aborted) throw signal.reason;
      return work(signal);
    })]);
  } finally {
    clearTimeout(timer);
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}
