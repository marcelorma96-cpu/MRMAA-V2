import { storeWebhook } from '@/lib/store-billing-server';
import { NextRequest } from 'next/server';
export const runtime='nodejs';
export const maxDuration=60;
export const POST=(req:NextRequest)=>storeWebhook(req,'google_play');
