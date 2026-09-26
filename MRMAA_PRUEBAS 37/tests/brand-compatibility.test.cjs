const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
function load(name, env = {}, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/', name+'.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, URL, Set, Symbol, process: { env }, require: key => key.startsWith('node:') ? require(key) : imports[key] };
  vm.runInNewContext(code, context);
  return context.exports;
}
test('existing/new payment domains work; lookalikes and unsafe URLs fail', () => {
  const {lemonURL} = load('lemon-squeezy', {}, {'./billing-server': {BillingError: Error}, './plans': {}});
  for (const host of ['pay.mrmaa.com','pay.unomesa.com','checkout.lemonsqueezy.com','store.lemonsqueezy.com']) {
    const url = `https://${host}/billing?expires=123&signature=example`;
    assert.equal(lemonURL(url),url);
  }
  for (const url of ['http://pay.unomesa.com/billing','https://pay.unomesa.com.evil.example','https://unomesa.com/billing','https://pay.unomesa.com:444/billing','https://user:secret@pay.unomesa.com/billing']) assert.throws(()=>lemonURL(url));
});
test('SMTP legacy fallback preserved; new roles independent; email text escaped but unchanged', () => {
  const env = {MRMAA_SMTP_FROM:'Original <verified@example.com>'};
  const mail = load('mail-brand', env, {'./site-origin':{siteOrigin:()=>{throw Error('unset')}}});
  assert.equal(mail.mailSender('passcode'),env.MRMAA_SMTP_FROM);
  assert.equal(mail.mailSender('support'),env.MRMAA_SMTP_FROM);
  env.UNOMESA_PASSCODE_FROM='UnoMesa <passcode@unomesa.com>';
  assert.equal(mail.mailSender('passcode'),env.UNOMESA_PASSCODE_FROM);
  assert.equal(mail.mailSender('support'),env.MRMAA_SMTP_FROM);
  env.UNOMESA_SUPPORT_FROM='UnoMesa <support@unomesa.com>';
  assert.equal(mail.mailSender('support'),env.UNOMESA_SUPPORT_FROM);
  const text='Código: 123456\nhttps://unomesa.com/?code=keep&next=1\n<script>alert(1)</script>';
  const branded=mail.brandMail({text,subject:'Verification',to:'member@example.com'});
  assert.equal(branded.text,text);assert.equal(branded.to,'member@example.com');
  assert(!branded.html.includes('<script>'));assert(branded.html.includes('123456'));assert(branded.html.includes('UnoMesa'));
});
test('email logo follows configured site without changing text URLs or recipients', () => {
  const mail=load('mail-brand', {}, {'./site-origin':{siteOrigin:()=> 'https://unomesa.com'}});
  const original={text:'https://mrmaa.com/?code=existing-token',to:'person@example.com'};
  const branded=mail.brandMail(original);
  assert.equal(branded.text,original.text);assert(branded.html.includes('https://unomesa.com/brand/unomesa-logo.png'));
});
test('both new domains allow public analytics, never account/payment callbacks or lookalikes', () => {
  const pixel=load('meta-pixel');
  const {filterLandingAnalytics:filter}=load('vercel-analytics',{}, {'./meta-pixel':pixel});
  for(const host of ['unomesa.com','www.unomesa.com']) {
    const root=`https://${host}/`;
    assert(pixel.isPublicLandingUrl(root+'?utm_source=facebook#planes'));
    assert.equal(filter({type:'pageview',url:root+'?utm_source=facebook#planes'},root,root,true).url,root);
    for(const suffix of ['?code=secret','?reset=1','?billing=return','?support=secret','#access_token=secret','api/account']) {
      assert(!pixel.isPublicLandingUrl(root+suffix));
      assert.equal(filter({type:'pageview',url:root+suffix},root+suffix,root+suffix,true),null);
    }
    assert(!pixel.isPublicLandingUrl(`https://${host}.evil.example/`));
  }
});
