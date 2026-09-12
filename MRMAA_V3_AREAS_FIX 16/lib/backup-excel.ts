import * as XLSX from "xlsx";

const sheets: Record<string, [string, string]> = {
  v2_restaurants: ["Restaurante", "Restaurant"], v2_members: ["Usuarios", "Users"],
  v2_clients: ["Clientes", "Customers"], v2_quotes: ["Cotizaciones", "Quotes"],
  v2_quote_items: ["Detalle cotizaciones", "Quote items"], v2_reservations: ["Reservaciones", "Reservations"],
  v2_areas: ["Áreas horarios", "Schedule areas"], v2_reservation_areas: ["Áreas reservaciones", "Reservation areas"],
  v2_employees: ["Empleados", "Employees"], v2_shifts: ["Turnos", "Shifts"],
  v2_schedules: ["Horarios", "Schedules"], v2_quote_products: ["Menús y productos", "Menus and products"],
  v2_audit_log: ["Historial", "History"],
};

export function buildBackupWorkbook(data: Record<string, unknown[]>, english = false) {
  const book = XLSX.utils.book_new();
  const overview: (string | number)[][] = [
    ["MRMAA", english ? "Data export" : "Exportación de datos"],
    [english ? "Exported at" : "Fecha de exportación", new Date().toISOString()],
    [english ? "Notes" : "Notas", english
      ? "Includes trash records (deleted_at). Field names and IDs retain their original values. Long values continue in numbered columns. JSON remains available as the technical backup."
      : "Incluye registros en papelera (deleted_at). Los campos e identificadores conservan sus valores originales. Los valores largos continúan en columnas numeradas. JSON sigue disponible como respaldo técnico."],
    [english ? "Sheet" : "Hoja", english ? "Records" : "Registros"],
  ];
  const summary = XLSX.utils.aoa_to_sheet(overview);
  XLSX.utils.book_append_sheet(book, summary, english ? "Summary" : "Resumen");
  for (const [table, records] of Object.entries(data)) {
    const name = sheets[table]?.[english ? 1 : 0] || table.slice(0, 25);
    overview.push([name, records.length]);
    // Stay below Excel's row limit, including the header.
    for (let offset = 0; offset < Math.max(1, records.length); offset += 100000) {
      const rows = records.slice(offset, offset + 100000).map(record => {
        const result: Record<string, string | number | boolean | null> = {};
        for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
          const cell = value == null ? null : typeof value === "object" ? JSON.stringify(value) : value;
          if (typeof cell === "string" && cell.length > 30000) {
            for (let start = 0; start < cell.length; start += 30000)
              result[start === 0 ? key : `${key} [${start / 30000 + 1}]`] = cell.slice(start, start + 30000);
          } else result[key] = cell as string | number | boolean | null;
        }
        return result;
      });
      const sheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([[english ? "No records" : "Sin registros"]]);
      const ref = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      sheet["!cols"] = Array.from({ length: ref.e.c + 1 }, () => ({ wch: 24 }));
      if (rows.length) sheet["!autofilter"] = { ref: sheet["!ref"]! };
      XLSX.utils.book_append_sheet(book, sheet, offset ? `${name.slice(0, 24)} ${offset / 100000 + 1}` : name);
    }
  }
  XLSX.utils.sheet_add_aoa(summary, overview, { origin: "A1" });
  summary["!cols"] = [{ wch: 28 }, { wch: 100 }];
  return book;
}

export function downloadBackupExcel(data: Record<string, unknown[]>, english = false) {
  XLSX.writeFile(buildBackupWorkbook(data, english), `MRMAA-${english ? "backup" : "respaldo"}-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
}
