export function RequestCountBadge({count,en}:{count:number;en:boolean}){
 if(count<1)return null;
 const value=count>=99?'99+':String(count);
 const label=en?`${value} new ${count===1?'request':'requests'}`:`${value} ${count===1?'solicitud nueva':'solicitudes nuevas'}`;
 return <span className="requestCountBadge" aria-label={label} title={label} translate="no">{value}</span>;
}
