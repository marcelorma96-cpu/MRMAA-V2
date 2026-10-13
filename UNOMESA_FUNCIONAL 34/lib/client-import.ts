import type * as XLSX from 'xlsx';
export const CLIENT_IMPORT_LIMIT = 5000;
export const CLIENT_IMPORT_BATCH = 500;
export type ClientImportStatus = 'new' | 'created' | 'existing' | 'trash' | 'duplicate' | 'invalid';
export type ClientImportRow = {
  row_number: number; id: string; name: string; phone: string; email: string; notes: string;
  status: ClientImportStatus; reason: string; match_name?: string;
};
export type ClientImportResult = { row_number: number; status: ClientImportStatus; reason: string; match_name?: string };
const headerKey = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases = {
  name: ['nombre','cliente','nombrecliente','nombredelcliente','name','customer','customername','clientname'],
  phone: ['telefono','tel','celular','phone','phonenumber','telephone'],
  email: ['correo','correoelectronico','email','emailaddress'],
  notes: ['notas','observaciones','notes','observations'],
};
export function clientImportIssue(row: Pick<ClientImportRow,'name'|'phone'|'email'|'notes'>) {
  if (!row.name || row.name.length > 200) return 'name';
  if (row.phone && (row.phone.length > 50 || !/^[+\d\s().-]+$/.test(row.phone) || !/\d/.test(row.phone))) return 'phone';
  if (row.email && (row.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))) return 'email';
  if (row.notes.length > 2000) return 'notes';
  return '';
}
export function markFileDuplicates(rows: ClientImportRow[]) {
  const names = new Set<string>(), phones = new Set<string>(), emails = new Set<string>();
  return rows.map(row => {
    if (row.status === 'invalid') return row;
    const name = row.name.toLowerCase(), phone = row.phone.replace(/\D/g,''), email = row.email.toLowerCase();
    const duplicate = phone && phones.has(phone) || email && emails.has(email) || !phone && !email && names.has(name);
    if (duplicate) return { ...row, status: 'duplicate' as const, reason: 'file_duplicate' };
    names.add(name); if (phone) phones.add(phone); if (email) emails.add(email);
    return row;
  });
}
/** Reads formatted cells directly so phone prefixes/leading zeroes are not coerced away. */
export function parseClientImport(book: XLSX.WorkBook, xlsx: typeof XLSX, makeId: () => string): ClientImportRow[] {
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet || !sheet['!ref']) throw new Error('empty');
  const full = xlsx.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
  if (full.e.r > CLIENT_IMPORT_LIMIT) throw new Error('rows');
  const range = xlsx.utils.decode_range(sheet['!ref']);
  const indices: Partial<Record<keyof typeof aliases, number>> = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[xlsx.utils.encode_cell({r:0,c})];
    const key = headerKey(cell?.v);
    for (const field of Object.keys(aliases) as (keyof typeof aliases)[]) if (aliases[field].includes(key)) {
      if (indices[field] !== undefined) throw new Error('headers_duplicate');
      indices[field] = c;
    }
  }
  if (indices.name === undefined) throw new Error('headers');
  const rows: ClientImportRow[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    let cellIssue = '';
    const values = {name:'',phone:'',email:'',notes:''};
    for (const field of Object.keys(values) as (keyof typeof values)[]) {
      const c = indices[field]; if (c === undefined) continue;
      const cell = sheet[xlsx.utils.encode_cell({r,c})]; if (!cell) continue;
      if (cell.f) cellIssue = 'formula';
      if (cell.t === 'e') cellIssue = 'cell';
      if (field === 'phone' && cell.t === 'n') {
        if (!Number.isSafeInteger(cell.v) || cell.v < 0 || String(cell.v).length > 15) cellIssue = 'phone_text';
        // Custom numeric masks can retain leading zeroes; avoid scientific/thousands formatting.
        const formatted = xlsx.utils.format_cell(cell);
        values[field] = /^\+?\d+$/.test(formatted) ? formatted : String(cell.v ?? '');
      } else values[field] = String(cell.v ?? '').trim();
    }
    if (!Object.values(values).some(Boolean) && !cellIssue) continue;
    values.email = values.email.toLowerCase();
    const reason = cellIssue || clientImportIssue(values);
    rows.push({row_number:r+1,id:makeId(),...values,status:reason?'invalid':'new',reason});
  }
  if (!rows.length) throw new Error('empty');
  return markFileDuplicates(rows);
}
export function clientImportPayload(rows: ClientImportRow[]) {
  return rows.map(({row_number,id,name,phone,email,notes}) => ({row_number,id,name,phone,email,notes}));
}
export function createClientTemplate(xlsx: typeof XLSX, en: boolean) {
  const headers = en ? ['Name','Phone','Email','Notes'] : ['Nombre','Teléfono','Correo','Notas'];
  const sheet = xlsx.utils.aoa_to_sheet([headers]);
  // Blank text cells prevent Excel from dropping + prefixes and leading zeroes.
  for (let r=1;r<=CLIENT_IMPORT_LIMIT;r++) for(let c=0;c<4;c++) sheet[xlsx.utils.encode_cell({r,c})]={t:'s',v:'',z:'@'};
  sheet['!ref']=`A1:D${CLIENT_IMPORT_LIMIT+1}`;
  sheet['!cols']=[{wch:32},{wch:24},{wch:36},{wch:60}];
  const instructions = en ? [
    ['Customer import template'],['Fill the Customers sheet. The template contains no sample customers to import.'],
    ['Name is required (up to 200 characters). Phone, email and notes are optional.'],
    ['Keep phone cells as Text. Include the country code consistently, e.g. +502 5555 1234.'],
    ['Use a valid email. Notes accept up to 2,000 characters. Use values, not formulas.'],
    ['Only the first sheet is read. Maximum: 5,000 data rows and 5 MB per file.'],
    ['Upload XLSX, XLS or CSV, review the results, then select Import new customers.'],
    ['Existing, deleted and duplicate customers are skipped; stored information is not overwritten.'],
    ['Example only — do not import this sheet:'],['Name','Phone','Email','Notes'],['Sample Customer','+502 5555 1234','customer@example.com','Optional note'],
  ] : [
    ['Plantilla de importación de clientes'],['Complete la hoja Clientes. La plantilla no contiene clientes de ejemplo para importar.'],
    ['Nombre es obligatorio (hasta 200 caracteres). Teléfono, correo y notas son opcionales.'],
    ['Mantenga el teléfono como Texto. Use el código de país consistentemente, ej. +502 5555 1234.'],
    ['Use un correo válido. Notas admite hasta 2,000 caracteres. Ingrese valores, no fórmulas.'],
    ['Solo se lee la primera hoja. Máximo: 5,000 filas de datos y 5 MB por archivo.'],
    ['Cargue XLSX, XLS o CSV, revise el resultado y pulse Importar clientes nuevos.'],
    ['Se omiten clientes existentes, en papelera y repetidos; no se sobrescribe información guardada.'],
    ['Ejemplo únicamente — esta hoja no se importa:'],['Nombre','Teléfono','Correo','Notas'],['Cliente de ejemplo','+502 5555 1234','cliente@example.com','Nota opcional'],
  ];
  const guide = xlsx.utils.aoa_to_sheet(instructions);guide['!cols']=[{wch:100},{wch:24},{wch:30},{wch:40}];
  const book=xlsx.utils.book_new();xlsx.utils.book_append_sheet(book,sheet,en?'Customers':'Clientes');xlsx.utils.book_append_sheet(book,guide,en?'Instructions':'Instrucciones');
  return book;
}
