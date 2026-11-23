/** Missing scope = not classified. Only an explicitly empty list is shared. */
export type ShiftScope = { schedule_area_ids?: string[] | null };
export const employeeAreaKey = (id?: string | null) => id || "unassigned";
export function shiftFitsArea(shift: ShiftScope | undefined, area: string) {
  const ids = shift?.schedule_area_ids;
  return !!area && Array.isArray(ids) && (ids.length === 0 || ids.includes(area));
}
export function shiftsForAreas<T extends ShiftScope>(shifts: T[], areas: string[]) {
  const unique = [...new Set(areas)];
  return unique.length ? shifts.filter(s => unique.every(area => shiftFitsArea(s, area))) : [];
}
