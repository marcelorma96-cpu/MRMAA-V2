"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, SESSION_SIGN_OUT_EVENT, isSigningOut } from '@/lib/supabase';
import { requirePermission, ACCESS_DENIED } from '@/lib/permissions';
import { userMessage } from '@/lib/user-message';
import { createScheduleUndoTransport, ScheduleRecoveryError, scheduleUndoMessage, type ScheduleAction, type ScheduleActionLabel, type ScheduleChange, type ScheduleReceipt } from '@/lib/schedule-undo';

type Props = { restaurantId: string; enabled: boolean; en: boolean; onChanged: () => void | Promise<void> };
type Context = { scope: string; generation: number; user: string; transport: ReturnType<typeof createScheduleUndoTransport> };
export function useScheduleUndo({ restaurantId, enabled, en, onChanged }: Props) {
  const [view, setView] = useState<{ scope: string; last: ScheduleAction | null; ready: boolean; busy: boolean; error: string }>({ scope: '', last: null, ready: false, busy: false, error: '' });
  const context = useRef<Context | null>(null), generation = useRef(0), reading = useRef(0), locked = useRef(false);
  const currentProps = useRef({ restaurantId, enabled, en, onChanged }); currentProps.current = { restaurantId, enabled, en, onChanged };
  const valid = (value: Context) => context.current === value && value.generation === generation.current && currentProps.current.restaurantId === value.scope.split('|')[0] && currentProps.current.enabled && !isSigningOut();
  const message = (error: unknown) => userMessage(scheduleUndoMessage(error, currentProps.current.en) || error);
  const update = (entered: Context, patch: Partial<typeof view>) => { if (valid(entered)) setView(previous => previous.scope === entered.scope ? { ...previous, ...patch } : previous); };
  async function readLatest(entered: Context, clearError = true) {
    const read = ++reading.current;
    try {
      const latest = await entered.transport.last();
      if (valid(entered) && reading.current === read && !locked.current) update(entered, { last: latest, ready: true, ...(clearError ? { error: '' } : {}) });
    } catch (error) {
      if (valid(entered) && reading.current === read && !locked.current) update(entered, { ready: false, error: message(error) });
    }
  }
  useEffect(() => {
    let active = true, authRevision = 0;
    const clear = () => {
      generation.current++; reading.current++; context.current = null; locked.current = false;
      if (active) setView({ scope: '', last: null, ready: false, busy: false, error: '' });
    };
    clear();
    const install = (user: string | undefined) => {
      if (!active || !enabled || !user || isSigningOut()) { clear(); return; }
      const scope = `${restaurantId}|${user}`;
      if (context.current?.scope === scope) return;
      clear();
      const entered: Context = { scope, user, generation: generation.current, transport: createScheduleUndoTransport(supabase, restaurantId) };
      context.current = entered;
      setView({ scope, last: null, ready: false, busy: false, error: '' });
      // Supabase auth callbacks must return synchronously; run RPC reads outside them.
      void Promise.resolve().then(() => { if (valid(entered)) return readLatest(entered); });
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { authRevision++; install(session?.user.id); });
    const initialRevision = authRevision;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authRevision !== initialRevision) return;
      if (error) { clear(); setView(previous => ({ ...previous, error: message(error) })); }
      else install(data.session?.user.id);
    }).catch(error => { if (active && authRevision === initialRevision) { clear(); setView(previous => ({ ...previous, error: message(error) })); } });
    const signOut = () => clear();
    if (typeof window !== 'undefined') window.addEventListener(SESSION_SIGN_OUT_EVENT, signOut);
    return () => {
      active = false; data.subscription.unsubscribe();
      if (typeof window !== 'undefined') window.removeEventListener(SESSION_SIGN_OUT_EVENT, signOut);
      generation.current++; reading.current++; context.current = null; locked.current = false;
    };
    // Identity changes explicitly rebuild the transport and invalidate all old responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, enabled]);
  async function authorized(entered: Context) {
    if (!valid(entered)) throw new Error('SCHEDULE_SCOPE_CHANGED');
    const session = await supabase.auth.getSession();
    if (session.error) throw session.error;
    if (session.data.session?.user.id !== entered.user) throw new Error('SCHEDULE_SCOPE_CHANGED');
    await requirePermission(supabase, currentProps.current.restaurantId, 'canManageSchedules');
    if (!valid(entered)) throw new Error('SCHEDULE_SCOPE_CHANGED');
  }
  async function accept(entered: Context, value: ScheduleReceipt, kind: 'apply' | 'undo') {
    if (!valid(entered)) throw new Error('SCHEDULE_SCOPE_CHANGED');
    reading.current++;
    if (kind === 'undo' || value.undone) update(entered, { last: null, ready: true, error: '' });
    else if (value.id && value.count > 0) update(entered, { last: { id: value.id, count: value.count, label: value.label, ...(value.from ? { from: value.from } : {}), ...(value.to ? { to: value.to } : {}) }, ready: true, error: '' });
    if (kind === 'undo' || value.count > 0) {
      // A refresh failure must not turn a committed save into a retryable write failure.
      try { await currentProps.current.onChanged(); }
      catch (error) { update(entered, { error: message(error) }); }
    }
  }
  async function mutate(kind: 'apply' | 'undo', changes: ScheduleChange[] = [], label: ScheduleActionLabel = 'edit') {
    const entered = context.current;
    if (!enabled || !entered) throw new Error(ACCESS_DENIED);
    if (currentProps.current.restaurantId !== restaurantId || !entered.scope.startsWith(`${restaurantId}|`)) throw new Error(message(new Error('SCHEDULE_SCOPE_CHANGED')));
    if (locked.current) throw new Error(scheduleUndoMessage(new Error('SCHEDULE_BUSY'), en));
    if (kind === 'apply' && !changes.length && !entered.transport.hasPending()) return null;
    locked.current = true; reading.current++;
    update(entered, { busy: true, error: '' });
    try {
      await authorized(entered);
      const action = view.scope === entered.scope ? view.last : null;
      if (kind === 'undo' && !action) throw new Error(en ? 'There is no recent action to undo.' : 'No hay una acción reciente para deshacer.');
      const value = kind === 'undo' ? await entered.transport.undo(action!.id) : await entered.transport.apply(changes, label);
      if (kind === 'apply' && value.undone) throw new ScheduleRecoveryError(value, 'undo');
      await accept(entered, value, kind);
      return value.id ? { id: value.id, count: value.count, label: value.label, ...(value.from ? { from: value.from } : {}), ...(value.to ? { to: value.to } : {}) } : null;
    } catch (error) {
      if (error instanceof ScheduleRecoveryError) await accept(entered, error.receipt, error.kind);
      if (valid(entered)) update(entered, { error: message(error) });
      throw new Error(message(error));
    } finally {
      if (valid(entered)) {
        locked.current = false; update(entered, { busy: false });
        // Includes commits whose response was lost; errors remain visible until an explicit refresh.
        void readLatest(entered, false);
      }
    }
  }
  const refresh = useCallback(async () => {
    const entered = context.current;
    if (entered && !locked.current) await readLatest(entered);
    // Uses the current context; never revive a prior restaurant/session's receipt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const visible = !!context.current && view.scope === context.current.scope && context.current.scope.startsWith(`${restaurantId}|`) && enabled;
  return { last: visible ? view.last : null, ready: visible && view.ready, busy: visible && view.busy, error: visible ? view.error : '',
    apply: (changes: ScheduleChange[], label: ScheduleActionLabel) => mutate('apply', changes, label),
    undo: async () => { await mutate('undo'); }, refresh };
}
