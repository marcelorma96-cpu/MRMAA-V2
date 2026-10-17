/** Browser exports are bounded independently of how many records a restaurant stores. */
export const EXPORT_ROW_LIMIT = 10_000;
export const PRINT_ROW_LIMIT = 2_000;
export const EXPORT_BYTE_LIMIT = 20 * 1024 * 1024;
export function exportBudget(maxRows = EXPORT_ROW_LIMIT, language?: string) {
  let rows = 0, bytes = 0;
  const encoder = new TextEncoder();
  return {
    add(batch: readonly unknown[]) {
      rows += batch.length;
      bytes += encoder.encode(JSON.stringify(batch)).byteLength;
      if (rows > maxRows || bytes > EXPORT_BYTE_LIMIT) {
        const en = (language || (typeof document !== 'undefined' ? document.documentElement.lang : 'es')).startsWith('en');
        throw new Error(en
          ? `This export exceeds ${maxRows.toLocaleString('en-US')} records or 20 MB. Narrow the dates or search. For a larger full backup, contact support.`
          : `Esta exportación supera ${maxRows.toLocaleString('en-US')} registros o 20 MB. Reduzca las fechas o la búsqueda. Para un respaldo completo mayor, contacte a soporte.`);
      }
    },
  };
}
