import { PLANS, planFor, type PlanCode, type BillingInterval } from './plans';
import {branchCount} from './branches';
export type StoreProvider = 'apple' | 'google_play';
type StoreItem={plan:PlanCode;cycle:BillingInterval;branches:number;apple:string;google_play:string;basePlan:string;name:string};
export const STORE_CATALOG:StoreItem[] = [...PLANS.flatMap(plan => (['month','year'] as const).map(cycle => ({
 plan:plan.code, cycle, branches:1, apple:`com.unomesa.${plan.code}.${cycle}`,
 google_play:`unomesa_${plan.code}`, basePlan:cycle === 'month' ? 'monthly' : 'anual', name:plan.name,
}))), ...Array.from({length:94},(_,i)=>({plan:'advanced' as const,cycle:'month' as const,branches:i+2,
 apple:`com.unomesa.advanced.branches${i+2}.month`,google_play:i<4?'multiple_locations':`unomesa_branches_${i+2}`,basePlan:i<4?`${i+2}-branches`:'monthly',name:`Advanced · ${i+2} sucursales`}))];
export function storeProduct(provider:StoreProvider, product:string, basePlan?:string) {
 // Verify earlier purchases without offering duplicate products for new sales.
 const legacy=provider==='google_play'&&basePlan==='monthly'&&/^unomesa_branches_[2-5]$/.test(product);
 const verifiedBasePlan=provider==='google_play'&&basePlan==='annual'&&/^unomesa_(basic|intermediate|advanced)$/.test(product)?'anual':basePlan;
 const item=legacy?STORE_CATALOG.find(p=>p.branches===Number(product.slice('unomesa_branches_'.length))):STORE_CATALOG.find(p=>p[provider]===product && (provider==='apple'||p.basePlan===verifiedBasePlan));
 if(!item) throw new Error('STORE_PRODUCT_NOT_ALLOWED'); return item;
}
export function selectedStoreProduct(plan:unknown, cycle:unknown, branches:unknown=1) {
 const count=branchCount(branches);const item=STORE_CATALOG.find(p=>p.plan===plan&&p.cycle===cycle&&p.branches===count); if(!item) throw new Error('STORE_PRODUCT_NOT_ALLOWED'); return item;
}
export function storeReplacementMode(provider:StoreProvider, current:Pick<StoreProof,'product'|'plan'|'cycle'|'branches'>, next:StoreItem) {
 if(current.plan===next.plan&&current.cycle===next.cycle&&current.branches===next.branches)return 'current';
 const downgrade=next.branches<current.branches||planFor(next.plan).monthly<planFor(current.plan).monthly;
 if(!downgrade)return 'immediate';
 // Play disallows DEFERRED when changing base plans within the same product.
 return provider==='google_play'&&current.product===next.google_play?'without_proration':'deferred';
}
export type StoreProof={provider:StoreProvider;mode:'test'|'live';external:string;reference:string;accountToken:string;product:string;plan:PlanCode;cycle:BillingInterval;branches:number;active:boolean;ended:boolean;until:string;cancel:boolean;linked?:string;resubscription?:{expired?:string;startedAt:string};acknowledge?:()=>Promise<void>};
