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
export async function readMfaAccess(client: SupabaseClient, signal?: AbortSignal) {
 const current = await client.auth.getSession();
 if (signal?.aborted) throw signal.reason;
 if (current.error) throw current.error;
 if (!current.data.session) return { allowed:true,userId:null };
 const query = client.rpc('v2_mfa_session_allowed');
 const result = await (signal ? query.abortSignal(signal) : query);
 if (result.error) throw { ...result.error, status: result.status };
 if (typeof result.data!=='boolean') throw { code:'SESSION_RESPONSE_INVALID' };
 return {allowed:result.data,userId:current.data.session.user.id};
}
