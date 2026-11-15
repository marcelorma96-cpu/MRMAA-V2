import { createClient } from '@supabase/supabase-js';
import { notFound,permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import type { Metadata } from 'next';
import { RestaurantPublicPage } from '@/components/restaurant-public-page';
import { validSlug,cleanContent } from '@/lib/restaurant-public';
export const dynamic='force-dynamic';
const read=cache(async(slug:string)=>{if(!validSlug(slug))return null;const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,cache:'no-store'})}});const r=await client.rpc('v2_public_page',{p_slug:slug});if(r.error)throw new Error('Public page temporarily unavailable');return r.data;});
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params,p=await read(slug);return {title:p?`${p.content.name} | UnoMesa`:'UnoMesa',description:p?.content.description?.slice(0,160),robots:{index:!!p,follow:!!p},alternates:p?{canonical:`/r/${p.slug}`}:undefined};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params,p=await read(slug);if(!p)notFound();if(p.slug!==slug)permanentRedirect(`/r/${p.slug}`);return <RestaurantPublicPage slug={p.slug} content={cleanContent(p.content)}/>;}
