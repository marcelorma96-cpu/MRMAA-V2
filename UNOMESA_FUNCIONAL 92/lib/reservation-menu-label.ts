/** Presentation only: repair known multiply-sign encoding errors before numeric quantities. */
export function reservationMenuLabel(value:string|null|undefined):string {
 return (value||'').replace(/\s+(?:×|√ó|Ã—|\u00c3\u0097)\s+(\d+(?:\.\d+)?)(?=\s*(?:,|$))/g,(_match,quantity:string)=>{
  const clean=quantity.includes('.')?quantity.replace(/0+$/,'').replace(/\.$/,''):quantity;
  return ` × ${clean}`;
 });
}
