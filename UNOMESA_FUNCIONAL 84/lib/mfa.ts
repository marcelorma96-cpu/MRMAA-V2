import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
export const MFA_REQUIRED = 'Complete la verificación en dos pasos para continuar.';
// Caller must first verify the same user/token with Auth getUser.
export async function requireVerifiedMfa(user: User, verifiedToken: string) {
 const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
  auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${verifiedToken}`}}
 });
 const result = await client.rpc('v2_mfa_session_allowed');
 if (!user.id || result.error || result.data !== true) throw new Error(MFA_REQUIRED);
}
export async function readMfaAccess(client: SupabaseClient) {
 const current = await client.auth.getSession();
 if (current.error) throw current.error;
 if (!current.data.session) return { allowed:true,userId:null };
 const result = await client.rpc('v2_mfa_session_allowed');
 if (result.error || typeof result.data!=='boolean') throw new Error(MFA_REQUIRED);
 return {allowed:result.data,userId:current.data.session.user.id};
}
