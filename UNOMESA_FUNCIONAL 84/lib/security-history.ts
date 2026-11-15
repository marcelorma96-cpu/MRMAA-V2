export type AuditRow = {
 id:number; table_name:string; entity_id:string|null; action:string; changed_by:string|null;
 actor_name:string|null; actor_role:string|null; changed_at:string;
 old_data:Record<string,unknown>|null; new_data:Record<string,unknown>|null;
 current_location:'present'|'trash'|'not_visible'|null; current_name:string|null;
 current_date_of_event:string|null; current_time_of_event:string|null; current_status:string|null;
};
const fields=[
 ['client_name','Nombre','Name'],['name','Nombre','Name'],['label','Descripción','Description'],['quote_number','N.º de cotización','Quote number'],
 ['event_date','Fecha de la reserva','Event date'],['event_time','Hora de la reserva','Event time'],['status','Estado','Status'],
 ['guests','Personas','Guests'],['area','Área','Area'],['deposit','Anticipo','Deposit'],['total','Total','Total'],['deleted_at','En papelera desde','Moved to trash at']
] as const;
export function auditValue(key:string,value:unknown,locale:string){
 if(value==null||value==='')return '—';
 const v=String(value);
 if(key==='event_date'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z')))return new Intl.DateTimeFormat(locale,{timeZone:'UTC',dateStyle:'medium'}).format(new Date(v+'T12:00:00Z'));
 if(key==='event_time'&&/^\d\d:\d\d/.test(v))return v.slice(0,5);
 if(key==='deleted_at'&&Number.isFinite(Date.parse(v)))return new Date(v).toLocaleString(locale);
 return v;
}
export function historyFields(row:AuditRow,en:boolean){
 return fields.filter(([key])=>(row.old_data?.[key]??null)!==(row.new_data?.[key]??null))
  .map(([key,es,eng])=>({key,label:en?eng:es,before:row.old_data?.[key],after:row.new_data?.[key]}));
}
export function historyLabel(row:AuditRow){
 const name=(d:AuditRow['old_data'])=>d?.client_name||d?.name||d?.label||(d?.quote_number?'#'+d.quote_number:'');
 const before=name(row.old_data),after=name(row.new_data);
 return before&&after&&before!==after?String(before)+' → '+String(after):String(after||before||row.entity_id||'—');
}
