import {NextRequest,NextResponse} from 'next/server';
import {billingContext,requestBody,BillingError} from '@/lib/billing-server';
import {changeBranches} from '@/lib/billing-lemon-provider';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:NextRequest){try{const body=await requestBody(req),context=await billingContext(req,body.restaurant_id);return changeBranches(req,{body,context});}catch(e){return NextResponse.json({error:e instanceof BillingError?e.message:'No se pudo verificar la cuenta.'},{status:e instanceof BillingError?e.status:503});}}
