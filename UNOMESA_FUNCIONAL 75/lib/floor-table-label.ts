/** Localize the standard abbreviation for display; never rename the stored table. */
export function floorTableName(name:string,en=false):string {
 const number=/^[mt](\d+)$/i.exec(name.trim());
 return number?`${en?'T':'M'}${number[1]}`:name;
}
