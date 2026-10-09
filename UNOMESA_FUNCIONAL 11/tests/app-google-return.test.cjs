const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const memory=()=>{const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}};
function setup({app=false,ua='',path='/auth/google',mode='app',fail=false}={}){
 const localStorage=memory(),sessionStorage=memory(),document={documentElement:{dataset:{}}},location={pathname:path,search:'?code=synthetic-test-code'};if(mode)sessionStorage.setItem('unomesa-google-destination',mode);
 const shared={window:{location},location,navigator:{userAgent:ua},matchMedia:()=>({matches:false}),document,sessionStorage,localStorage};if(app)document.documentElement.dataset.unomesaApp='true';
 const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const appExports={};vm.runInNewContext(compile(fs.readFileSync('lib/app-mode.ts','utf8')),{...shared,exports:appExports});
 const calls=[],sessionExports={},exports={};
 const auth={initialize:async()=>({error:null}),setSession:async tokens=>{calls.push(['set',appExports.isAppMode(),tokens.access_token]);return{data:{session:{user:{id:'fixture-user'}}},error:null}}};
 const dependencies={'@/lib/app-mode':appExports,'@/lib/session-activity':{ACTIVITY_KEY:'activity'},'@/lib/supabase':{supabase:{auth}},'@/lib/google-auth':{GOOGLE_AUTH_ENABLED:true,googleOAuthClient:()=>({auth:{exchangeCodeForSession:async(code,options)=>{calls.push(['exchange',code,options]);return fail?{error:new Error('expired')}:{data:{session:{access_token:'synthetic-access',refresh_token:'synthetic-refresh'},user:{id:'fixture-user'}}}}}}),hasGoogleIdentity:()=>true,clearGoogleOAuthStorage:()=>calls.push(['clear'])}};
 vm.runInNewContext(compile(fs.readFileSync('lib/google-session.ts','utf8')),{...shared,exports:sessionExports,Date,Error,require:n=>dependencies[n]});
 vm.runInNewContext(compile(fs.readFileSync('app/auth/google/page.tsx','utf8')+'\nexport {completeGoogle};'),{...shared,exports,URLSearchParams,Date,history:{replaceState:(_s,_t,p)=>calls.push(['strip',p])},require:n=>({...dependencies,'react/jsx-runtime':{},'react':{},'@/components/app-preferences':{},'@/lib/google-session':sessionExports}[n])});
 return {api:appExports,complete:exports.completeGoogle,finish:sessionExports.completeGoogleSession,auth,localStorage,sessionStorage,calls,document};
}
test('Google app return restores app before credential storage and keeps activity across launches',async()=>{const x=setup();await x.complete();assert.equal(x.calls.find(c=>c[0]==='set')[1],true);assert(x.localStorage.getItem('activity'));assert.equal(x.sessionStorage.getItem('activity'),null);assert.equal(x.api.accountEntryPath(),'/mobile?login=1');assert.equal(x.sessionStorage.getItem('unomesa-google-destination'),null);assert.equal(x.calls[0][0],'strip');assert.equal(x.calls.at(-1)[0],'clear')});
test('web Google return stays in web session storage; untrusted hints are not redirect destinations',async()=>{for(const mode of ['web','https://outside.invalid']){const x=setup({mode});await x.complete();assert.equal(x.calls.find(c=>c[0]==='set')[1],false);assert(x.sessionStorage.getItem('activity'));assert.equal(x.api.accountEntryPath(),'/login')}});
test('native return and expired Google callbacks stay in app without installing a failed session',async()=>{const native=setup({mode:null,ua:'UnoMesa-iOS/1.0.4'});await native.complete();assert.equal(native.api.accountEntryPath(),'/mobile?login=1');const fail=setup({fail:true});await assert.rejects(fail.complete());assert.equal(fail.api.accountEntryPath(),'/mobile?login=1');assert(!fail.calls.some(c=>c[0]==='set'));assert.equal(fail.calls.at(-1)[0],'clear')});

test('in-place completion keeps its exact PKCE flow and verifies installed user before routing',async()=>{
 const x=setup({ua:'UnoMesa-iOS/1.0.12'});assert.equal(await x.finish('synthetic-code','1234567890abcdef1234567890abcdef'),'/mobile?login=1');
 assert.equal(x.calls.find(c=>c[0]==='exchange')[2].flowId,'1234567890abcdef1234567890abcdef');
 const bad=setup();bad.auth.setSession=async()=>({data:{session:{user:{id:'other-user'}}},error:null});await assert.rejects(bad.finish('synthetic-code'),/GOOGLE_SESSION/);assert.equal(bad.calls.at(-1)[0],'clear');
});
