import { randomUUID } from 'node:crypto';

const knownCodes = new Set(['missing-input-secret', 'invalid-input-secret', 'missing-input-response', 'invalid-input-response', 'bad-request', 'timeout-or-duplicate', 'internal-error']);
const knownNetworkCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']);

/** Only these bounded diagnostic fields may enter logs. Never log the raw response/error. */
export class PublicTurnstileError extends Error {
  status: number;
  reason: string;
  providerCodes: string[];
  httpStatus: number | undefined;
  attempts: number;
  networkCode: string | undefined;
  constructor(status: number, reason: string, attempts = 0, httpStatus?: number, providerCodes: string[] = [], networkCode?: string) {
    super(status === 400 ? 'CAPTCHA' : 'CAPTCHA_UNAVAILABLE');
    this.status = status;
    this.reason = reason;
    this.attempts = attempts;
    this.httpStatus = httpStatus;
    this.providerCodes = providerCodes;
    this.networkCode = networkCode;
  }
  diagnostic() {
    return { reason: this.reason, providerCodes: this.providerCodes, httpStatus: this.httpStatus, attempts: this.attempts, networkCode: this.networkCode };
  }
}

/** A separate fresh token is required for each form; the widget/key pair may be shared. */
export async function verifyPublicTurnstile(options: {
  secret?: string;
  siteKey?: string;
  token: unknown;
  hostname: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}) {
  const secret = (options.secret || '').trim();
  const siteKey = (options.siteKey || '').trim();
  // Preserve installations where Turnstile is intentionally not configured at all.
  if (!secret && !siteKey) return;
  if (!secret) throw new PublicTurnstileError(503, 'missing-secret');
  if (secret === siteKey) throw new PublicTurnstileError(503, 'site-key-used-as-secret');
  const token = typeof options.token === 'string' ? options.token.trim() : '';
  if (!token || token.length > 2048) throw new PublicTurnstileError(400, 'invalid-token-format');

  const fetchImpl = options.fetchImpl || fetch;
  // Reuse only for retries of this exact validation, never across form submissions.
  const idempotencyKey = randomUUID();
  const body = JSON.stringify({ secret, response: token, idempotency_key: idempotencyKey });
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
    let response: Response;
    let data: any;
    try {
      response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      // Read Cloudflare's error codes even when it returns HTTP 400.
      data = await response.json().catch(() => null);
    } catch (error) {
      const timedOut = controller.signal.aborted;
      const candidate = (error as { cause?: { code?: unknown } })?.cause?.code;
      const networkCode = typeof candidate === 'string' && knownNetworkCodes.has(candidate) ? candidate : undefined;
      if (attempt < 2) continue;
      throw new PublicTurnstileError(503, timedOut ? 'verification-timeout' : 'verification-network', attempt, undefined, [], networkCode);
    } finally {
      clearTimeout(timer);
    }
    const codes: string[] = Array.isArray(data?.['error-codes'])
      ? [...new Set<string>(data['error-codes'].filter((x: unknown): x is string => typeof x === 'string' && knownCodes.has(x)))] : [];
    if (codes.includes('missing-input-secret') || codes.includes('invalid-input-secret'))
      throw new PublicTurnstileError(503, 'invalid-secret', attempt, response.status, codes);
    const transient = response.status === 408 || response.status === 429 || response.status >= 500 || codes.includes('internal-error');
    if (transient) {
      if (attempt < 2) continue;
      throw new PublicTurnstileError(503, 'provider-unavailable', attempt, response.status, codes);
    }
    if (codes.includes('bad-request'))
      throw new PublicTurnstileError(503, 'provider-bad-request', attempt, response.status, codes);
    if ((response.ok || response.status === 400) && data?.success === false && codes.some(c => ['missing-input-response', 'invalid-input-response', 'timeout-or-duplicate'].includes(c)))
      throw new PublicTurnstileError(400, 'token-rejected', attempt, response.status, codes);
    if (!response.ok)
      throw new PublicTurnstileError(503, 'provider-http-error', attempt, response.status, codes);
    if (!data || typeof data.success !== 'boolean')
      throw new PublicTurnstileError(503, 'provider-invalid-response', attempt, response.status, codes);
    if (data.success !== true)
      throw new PublicTurnstileError(400, 'token-rejected', attempt, response.status, codes);
    if (typeof data.hostname !== 'string' || data.hostname.toLowerCase() !== options.hostname.toLowerCase())
      throw new PublicTurnstileError(400, 'hostname-mismatch', attempt, response.status);
    return;
  }
}
