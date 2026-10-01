// Keep logout finite even if the network disappears. Server expiry remains the
// fallback when neither the database nor Auth can be reached.
async function bounded<T>(run: () => PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(run),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SESSION_TIMEOUT')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function endSession(actions: {
  revoke: () => PromiseLike<unknown>;
  signOut: () => PromiseLike<{ error: unknown }>;
  forceLocal: () => void;
}, timeoutMs = 6000) {
  // Revoke application access first; Auth logout then removes the auth session.
  try { await bounded(actions.revoke, timeoutMs); } catch { /* Auth can still close it. */ }
  try {
    const result = await bounded(actions.signOut, timeoutMs);
    if (result.error) actions.forceLocal();
  } catch { actions.forceLocal(); }
}
