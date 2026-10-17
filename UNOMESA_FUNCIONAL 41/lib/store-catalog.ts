import { PLANS, type PlanCode, type BillingInterval } from './plans';
import {branchCount} from './branches';
export type StoreProvider = 'apple' | 'google_play';
type StoreItem={plan:PlanCode;cycle:BillingInterval;branches:number;apple:string;google_play:string;basePlan:string;name:string};
export const STORE_CATALOG:StoreItem[] = [...PLANS.flatMap(plan => (['month','year'] as const).map(cycle => ({
 plan:plan.code, cycle, branches:1, apple:`com.unomesa.${plan.code}.${cycle}`,
 google_play:`unomesa_${plan.code}`, basePlan:cycle === 'month' ? 'monthly' : 'annual', name:plan.name,
}))), ...Array.from({length:94},(_,i)=>({plan:'advanced' as const,cycle:'month' as const,branches:i+2,
 apple:`com.unomesa.advanced.branches${i+2}.month`,google_play:`unomesa_branches_${i+2}`,basePlan:'monthly',name:`Advanced · ${i+2} sucursales`}))];
export function storeProduct(provider:StoreProvider, product:string, basePlan?:string) {
 const item=STORE_CATALOG.find(p=>p[provider]===product && (provider==='apple'||p.basePlan===basePlan));
 if(!item) throw new Error('STORE_PRODUCT_NOT_ALLOWED'); return item;
}
export function selectedStoreProduct(plan:unknown, cycle:unknown, branches:unknown=1) {
 const count=branchCount(branches);const item=STORE_CATALOG.find(p=>p.plan===plan&&p.cycle===cycle&&p.branches===count); if(!item) throw new Error('STORE_PRODUCT_NOT_ALLOWED'); return item;
}
export type StoreProof={provider:StoreProvider;mode:'test'|'live';external:string;reference:string;accountToken:string;product:string;plan:PlanCode;cycle:BillingInterval;branches:number;active:boolean;ended:boolean;until:string;cancel:boolean;linked?:string;acknowledge?:()=>Promise<void>};
