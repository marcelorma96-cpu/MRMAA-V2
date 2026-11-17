import './schedule-shift-areas.css';
type Area = { id:string; name:string; active:boolean };
type Props = { areas:Area[]; ids:string[]|null; en:boolean; disabled:boolean; change:(ids:string[]|null)=>void };
export function ShiftAreaPicker({areas,ids,en,disabled,change}:Props) {
  return <fieldset className="shiftAreaPicker" disabled={disabled}>
    <legend>{en?'Available in':'Disponible en'}</legend>
    <div>{areas.filter(a=>a.active||ids?.includes(a.id)).map(a=>{
      const checked=!!ids?.includes(a.id);
      return <button type="button" aria-pressed={checked} key={a.id} onClick={()=>{
        const next=checked?ids!.filter(x=>x!==a.id):[...(ids||[]),a.id];change(next.length?next:null);
      }}>{a.name}</button>;
    })}
    <button type="button" aria-pressed={Array.isArray(ids)&&!ids.length} onClick={()=>change([])}>{en?'All areas':'Todas las áreas'}</button></div>
    {ids===null&&<small>{en?'Choose where this shift can be assigned.':'Elige en qué áreas se podrá asignar este turno.'}</small>}
  </fieldset>;
}
