import type { ScheduleRow } from './schedule-range';
import type { Operation } from './schedule-grid';

export type ScheduleChange = { before: ScheduleRow | null; after: ScheduleRow | null };
export type ScheduleActionLabel = 'assign' | 'edit' | 'move' | 'copy' | 'delete';
export type ScheduleAction = { id: string; count: number; label: ScheduleActionLabel; from?: string; to?: string };
export type ScheduleReceipt = { id: string | null; count: number; label: ScheduleActionLabel; from?: string; to?: string; undone?: boolean };
export const MAX_SCHEDULE_CHANGES = 5000;
const newId = () => globalThis.crypto.randomUUID();
const key = (row: Pick<ScheduleRow, 'employee_id' | 'work_date'>) => `${row.employee_id}|${row.work_date}`;
const time = (value: string | null | undefined) => !value ? null : /^\d\d:\d\d$/.test(value) ? `${value}:00` : value;

/** Only assignment columns enter an optimistic snapshot. Tenant and metadata stay server-owned. */
export function normalizeSchedule(row: ScheduleRow): ScheduleRow {
  return { id: row.id, employee_id: row.employee_id, work_date: row.work_date,
    area_id: row.area_id || null, shift_id: row.shift_id || null, entry_type: row.entry_type,
    color: row.color || null, break_start: time(row.break_start), break_end: time(row.break_end), notes: row.notes ?? '' };
}
const unchanged = (before: ScheduleRow | null, after: ScheduleRow | null) => JSON.stringify(before) === JSON.stringify(after);
function bounded(changes: ScheduleChange[]) {
  if (changes.length > MAX_SCHEDULE_CHANGES) throw new Error('Seleccione hasta 5000 casillas por acción.');
  const ids = new Set<string>();
  for (const change of changes) {
    const id = change.before?.id || change.after?.id;
    if (!id || ids.has(id) || (change.before && change.after && change.before.id !== change.after.id)) throw new Error('Selección de horarios inválida.');
    ids.add(id);
  }
  return changes;
}
export function scheduleChanges(payload: Omit<ScheduleRow, 'id'>[], existing: ScheduleRow[], makeId: () => string = newId): ScheduleChange[] {
  if (payload.length > MAX_SCHEDULE_CHANGES) throw new Error('Seleccione hasta 5000 casillas por acción.');
  const previous = new Map(existing.map(row => [key(row), row])), targets = new Set<string>();
  return bounded(payload.flatMap(row => {
    const target = key(row);
    if (targets.has(target)) throw new Error('Casillas repetidas.');
    targets.add(target);
    const before = previous.has(target) ? normalizeSchedule(previous.get(target)!) : null;
    const after = normalizeSchedule({ ...row, id: before?.id || makeId() });
    return unchanged(before, after) ? [] : [{ before, after }];
  }));
}
export function scheduleGridChanges(mode: 'edit' | 'move', operations: Operation[], patch: Record<string, string | null>, employees: { id: string; area_id: string | null }[], makeId: () => string = newId): ScheduleChange[] {
  if (operations.length > MAX_SCHEDULE_CHANGES) throw new Error('Seleccione hasta 5000 casillas por acción.');
  const allowed = ['entry_type', 'shift_id', 'color', 'break_start', 'break_end', 'notes'];
  if (Object.keys(patch).some(field => !allowed.includes(field))) throw new Error('Selección de horarios inválida.');
  const people = new Map(employees.map(person => [person.id, person]));
  return bounded(operations.flatMap(operation => {
    const before = operation.expected ? normalizeSchedule(operation.expected) : null;
    const employee = people.get(operation.to.employee_id);
    if (!employee) throw new Error('Empleado de destino no disponible.');
    let after: ScheduleRow;
    if (mode === 'move') {
      if (!before) throw new Error('Seleccione una casilla con horario para mover.');
      after = normalizeSchedule({ ...before, ...operation.to, area_id: before.employee_id === operation.to.employee_id ? before.area_id : employee.area_id });
    } else {
      if (key(operation) !== key(operation.to)) throw new Error('Destino inválido.');
      const base: ScheduleRow = before || { id: makeId(), ...operation.to, area_id: employee.area_id, shift_id: null, entry_type: '', color: null, break_start: null, break_end: null, notes: '' };
      const type = patch.entry_type ?? base.entry_type;
      if (!['work', 'rest', 'permission', 'vacation'].includes(type)) throw new Error('Seleccione una asignación para las casillas vacías.');
      after = normalizeSchedule({ ...base, ...patch, entry_type: type, notes: patch.notes === null ? '' : patch.notes ?? base.notes,
        shift_id: type === 'work' ? (Object.hasOwn(patch, 'shift_id') ? patch.shift_id : base.shift_id) : null,
        break_start: type === 'work' ? (Object.hasOwn(patch, 'break_start') ? patch.break_start : base.break_start) : null,
        break_end: type === 'work' ? (Object.hasOwn(patch, 'break_end') ? patch.break_end : base.break_end) : null });
      if (type === 'work' && !after.shift_id) throw new Error('Seleccione un turno disponible.');
    }
    return unchanged(before, after) ? [] : [{ before, after }];
  }));
}

type RpcResult = { data: unknown; error: unknown };
export type ScheduleRpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult> };
type Pending = { name: string; args: Record<string, unknown>; kind: 'apply' | 'undo' };
export class ScheduleRecoveryError extends Error {
  constructor(public receipt: ScheduleReceipt, public kind: 'apply' | 'undo') { super('SCHEDULE_RECOVERED'); }
}
function receipt(value: unknown): ScheduleReceipt {
  if (!value || typeof value !== 'object') throw new Error('SCHEDULE_RESPONSE_UNCERTAIN');
  const candidate = value as ScheduleReceipt;
  if ((typeof candidate.id !== 'string' && candidate.id !== null) || !Number.isInteger(candidate.count) || candidate.count < 0 || !['assign','edit','move','copy','delete'].includes(candidate.label)) throw new Error('SCHEDULE_RESPONSE_UNCERTAIN');
  return candidate;
}
export function scheduleTransportError(error: unknown) {
  const e = error as { message?: string; code?: string; status?: number };
  return e?.message === 'SCHEDULE_RESPONSE_UNCERTAIN' || (!e?.code && (error instanceof TypeError || /fetch|network|connection|timeout|timed out|load failed/i.test(e?.message || ''))) || e?.status === 0 || [502,503,504].includes(e?.status || 0);
}
/** Exact request data and UUID are retained until the server outcome is known. */
export function createScheduleUndoTransport(client: ScheduleRpcClient, restaurantId: string, makeId: () => string = newId) {
  let pending: Pending | null = null, locked = false;
  async function sendPending(): Promise<ScheduleReceipt> {
    const operation = pending!;
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await client.rpc(operation.name, operation.args);
        if (result.error) throw result.error;
        const resultReceipt = receipt(result.data); pending = null; return resultReceipt;
      } catch (error) {
        if (!scheduleTransportError(error)) { pending = null; throw error; }
        if (attempt >= 1) throw error;
      }
    }
  }
  async function mutate(operation: () => Pending): Promise<ScheduleReceipt> {
    if (locked) throw new Error('SCHEDULE_BUSY');
    locked = true;
    try {
      if (pending) {
        const kind = pending.kind, recovered = await sendPending();
        // Never silently substitute the recovered older action for the new caller intent.
        throw new ScheduleRecoveryError(recovered, kind);
      }
      pending = operation();
      return await sendPending();
    } finally { locked = false; }
  }
  return {
    apply(changes: ScheduleChange[], label: ScheduleActionLabel): Promise<ScheduleReceipt> {
      const normalized = bounded(changes.map(change => ({ before: change.before ? normalizeSchedule(change.before) : null, after: change.after ? normalizeSchedule(change.after) : null }))).filter(change => !unchanged(change.before, change.after));
      if (!normalized.length && !pending) return Promise.resolve({ id: null, count: 0, label });
      return mutate(() => ({ kind: 'apply', name: 'v2_apply_schedule_change', args: { p_restaurant: restaurantId, p_request: makeId(), p_changes: normalized, p_label: label } }));
    },
    undo(action: string) { return mutate(() => ({ kind: 'undo', name: 'v2_undo_schedule_change', args: { p_restaurant: restaurantId, p_action: action } })); },
    async last(): Promise<ScheduleAction | null> {
      const result = await client.rpc('v2_last_schedule_change', { p_restaurant: restaurantId });
      if (result.error) throw result.error;
      if (result.data == null) return null;
      const value = receipt(result.data);
      return value.id && !value.undone ? { id: value.id, count: value.count, label: value.label, ...(value.from ? { from: value.from } : {}), ...(value.to ? { to: value.to } : {}) } : null;
    },
    hasPending: () => pending !== null,
  };
}
export function scheduleUndoMessage(error: unknown, en: boolean) {
  const e = error as { code?: string; message?: string };
  const message = e?.message || '';
  if (e?.code === 'PGRST202' || e?.code === '42883') return en ? 'Install schedule update 72 in Supabase to enable saving and Undo.' : 'Instala la actualización 72 de horarios en Supabase para habilitar el guardado y Deshacer.';
  if (e?.code === '42501') return en ? 'Your current access does not allow changes to these schedules. Contact the administrator.' : 'Tu acceso actual no permite modificar estos horarios. Consulta al administrador.';
  if (message === 'SCHEDULE_REQUEST_REUSED') return en ? 'Reopen the calendar and review the saved schedules before trying again.' : 'Vuelve a abrir el calendario y revisa los horarios guardados antes de intentarlo de nuevo.';
  if (e?.code === '22023' || e?.code === '23514' || message === 'SCHEDULE_ACTION_INVALID') return en ? 'Check the employees, dates and shifts before trying this action again.' : 'Revisa los empleados, las fechas y los turnos antes de intentar esta acción de nuevo.';
  if (e?.code === '40001' || e?.code === '40P01' || /SCHEDULE_(?:UNDO_)?(?:CHANGED|NOT_LATEST)/.test(message)) return en ? 'These schedules or the latest action changed. Refresh and review them; nothing was overwritten.' : 'Estos horarios o la última acción cambiaron. Actualiza y revísalos; no se sobrescribió ningún cambio.';
  if (e?.code === '23505' || /SCHEDULE_OCCUPIED/.test(message)) return en ? 'A destination already has a schedule. Review the calendar; the action was not applied.' : 'Una casilla de destino ya tiene horario. Revisa el calendario; no se aplicó la acción.';
  if (message === 'SCHEDULE_BUSY') return en ? 'Wait for the current change to finish.' : 'Espera a que termine el cambio en curso.';
  if (message === 'SCHEDULE_RECOVERED') return en ? 'The previous action was recovered. Review the calendar before making another change.' : 'Se recuperó la acción anterior. Revisa el calendario antes de hacer otro cambio.';
  if (message === 'SCHEDULE_SCOPE_CHANGED') return en ? 'Your session or restaurant changed. Reopen the calendar.' : 'Cambió tu sesión o restaurante. Vuelve a abrir el calendario.';
  if (scheduleTransportError(error)) return en ? 'The connection was interrupted. Refresh to check the result before making another change.' : 'Se interrumpió la conexión. Actualiza para comprobar el resultado antes de hacer otro cambio.';
  return message;
}
