import type {SupabaseClient} from '@supabase/supabase-js';

// Server-only queries: never derive ownership from an email match or grant access to it.
export async function registrationHistory(admin:SupabaseClient,email:string,userId?:string):Promise<'ready'|'blocked'|'new'> {
 const normalized=email.trim().toLowerCase();
 if(!normalized||!normalized.includes('@'))throw new Error('REGISTRATION_IDENTITY');
 const read=async(query:PromiseLike<{data:any;error:any}>)=>{const r=await query;if(r.error||!Array.isArray(r.data))throw new Error('REGISTRATION_LOOKUP');return r.data;};
 if(userId){
  const members=await read(admin.from('v2_members').select('user_id,status').eq('user_id',userId).limit(100));
  if(members.some(m=>m.status==='activo'))return 'ready';
  if(members.length)return 'blocked';
  const owners=await read(admin.from('v2_restaurants').select('id').eq('owner_id',userId).limit(1));
  if(owners.length)return 'blocked';
  const accepted=await read(admin.from('v2_legal_acceptances').select('user_id').eq('user_id',userId).limit(1));
  if(accepted.length)return 'blocked';
 }
 // Escape LIKE metacharacters so a literal email cannot match other users.
 const pattern=normalized.replace(/[\\%_]/g,'\\$&');
 const sameEmail=await read(admin.from('v2_members').select('user_id').ilike('email',pattern).limit(1));
 return sameEmail.length?'blocked':'new';
}
