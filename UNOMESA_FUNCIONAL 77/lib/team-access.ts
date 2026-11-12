export type BranchPermission={id:string;selected:boolean;role:string;expected?:{role:string;status:string}|null;name?:string};
export type PermissionDraft=Record<string,BranchPermission>;
export type InvitationAccess={company:string;branches:{id:string;name:string;role:string}[];restaurant_id:string};
export const teamRoles=[{value:'administrador',es:'Administrador',en:'Administrator'},{value:'gerente',es:'Gerente',en:'Manager'},{value:'operacion',es:'Operación',en:'Operations'},{value:'lectura',es:'Solo lectura',en:'Read only'}];
export function roleLabel(role:string,en=false){return teamRoles.find(r=>r.value===role)?.[en?'en':'es']||role;}
