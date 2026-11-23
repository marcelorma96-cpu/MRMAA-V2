import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "./permissions";
import type { ShiftTimes } from "./schedule-range";

export type CatalogKind = "employee" | "shift";
export type CatalogEmployee = { id:string; name:string; employee_code:string; phone:string; area_id:string|null; active:boolean };
export type CatalogShift = ShiftTimes & { id:string; active:boolean; break_minutes:number; schedule_area_ids?:string[]|null };
export const catalogFields = {
  employee: ["name", "employee_code", "phone", "area_id", "active"],
  shift: ["name", "start_time", "end_time", "start_text", "end_text", "calculation_start_time", "calculation_end_time", "break_minutes", "schedule_area_ids", "active"],
} as const;
export function catalogSnapshot(kind:CatalogKind, row:object) {
  const record=row as Record<string,unknown>;
  return Object.fromEntries(catalogFields[kind].map(key=>[key,record[key]??null]));
}
export function employeePayload(draft:{name:string; employee_code:string; phone:string; area_id:string; active:boolean}) {
  const name=draft.name.trim(), employee_code=draft.employee_code.trim(), phone=draft.phone.trim();
  if(!name || name.length>160 || employee_code.length>80 || phone.length>60) return null;
  return {name,employee_code,phone,area_id:draft.area_id||null,active:draft.active};
}
/** Rechecks current membership; the RPC enforces the same restriction in PostgreSQL. */
export async function saveScheduleCatalog(client:SupabaseClient,restaurantId:string,kind:CatalogKind,id:string,values:object,expected:object|null) {
  await requirePermission(client,restaurantId,"canManageScheduleCatalog");
  const result=await client.rpc("v2_save_schedule_catalog",{p_restaurant:restaurantId,p_kind:kind,p_id:id,p_values:values,p_expected:expected});
  if(result.error)throw result.error;
  if(!result.data?.id)throw new Error("No se pudo confirmar el cambio. Revisa la lista antes de reintentar.");
  return result.data as CatalogEmployee|CatalogShift;
}
export function catalogError(error:unknown,en:boolean) {
  const e=error as {code?:string;message?:string};
  if(e?.code==="40001")return en?"Someone changed this record. Your draft is kept; go back and reopen it to review the latest version.":"Alguien modificó este registro. Conservamos tu texto; vuelve a la lista y ábrelo otra vez para revisar la versión actual.";
  if(e?.code==="23505")return en?"This record already exists. Review the list before adding it again.":"Este registro ya existe. Revisa la lista antes de agregarlo otra vez.";
  if(e?.code==="42501")return en?"Only an active administrator or manager with access to schedules can save these changes.":"Solo un administrador o gerente activo con acceso a horarios puede guardar estos cambios.";
  if(e?.code==="PGRST202" || e?.code==="42883")return en?"This feature is not enabled yet. Ask your administrator to complete the update.":"Esta función todavía no está habilitada. Pide al administrador que complete la actualización.";
  return null;
}
