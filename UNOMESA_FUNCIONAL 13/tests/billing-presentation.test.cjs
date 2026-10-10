const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const output={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/billing-presentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:output,exports:output.exports,Date,Number});
const {billingPresentation:view}=output.exports,now=Date.parse('2026-10-09T00:00:00Z');
test('expired paid subscription shows the paid date and never promises continued access',()=>{
 const account={can_write:false,billing_current_period_end:'2026-10-03',trial_ends_at:'2026-09-20',billing_cancel_at_period_end:true};
 const before=JSON.stringify(account),p=view(account,now);
 assert.equal(p.end,Date.parse('2026-10-03'));assert.equal(p.ended,true);assert.equal(p.paid,true);assert.equal(p.renewal,'cancelled');assert.equal(JSON.stringify(account),before);
});
test('continued paid access requires both permission and an unexpired period',()=>{
 const a={can_write:true,billing_current_period_end:'2026-11-03',billing_cancel_at_period_end:true};
 assert.equal(view(a,now).renewal,'through-period');assert.equal(view({...a,can_write:false},now).renewal,'cancelled');
 assert.equal(view(a,Date.parse(a.billing_current_period_end)).renewal,'cancelled');
});
test('invalid or absent dates never become epoch dates or crash formatting; exemptions keep no payment deadline',()=>{
 assert.equal(view({},now).end,null);assert.equal(view({trial_ends_at:'invalid'},now).end,null);
 const p=view({trial_ends_at:'2026-10-03'},now);assert.equal(p.paid,false);assert.equal(p.trialEnded,true);
 const free=view({trial_exempt:true,billing_cancel_at_period_end:true,trial_ends_at:'2026-10-03'},now);assert.equal(free.end,null);assert.equal(free.renewal,null);
});
