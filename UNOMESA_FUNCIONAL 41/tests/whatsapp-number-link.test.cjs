require('tsx/cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {directWhatsAppLink}=require('../lib/public-contact.ts');
const {cleanContent,contactLink}=require('../lib/restaurant-public.ts');
test('country-code phone numbers generate the official direct link with no message',()=>{
 for(const [input,digits] of [['+502 2257 6901','50222576901'],['+1 (803) 555-1234','18035551234'],['+52 55 1234 5678','525512345678'],['00502 22576901','50222576901']]){
  const url=directWhatsAppLink(input);assert.equal(url,`https://api.whatsapp.com/send?phone=${digits}`);assert.equal(new URL(url).searchParams.has('text'),false);
  const saved=cleanContent({whatsapp:input,whatsapp_link:url,channels:['whatsapp']});assert.equal(saved.whatsapp,digits);assert.equal(contactLink('whatsapp',saved,'Do not prefill this'),url);
 }
 for(const bad of ['22576901','','abc','+1 502 2257 6901','https://evil.test/50222576901','50222576901&text=unwanted'])assert.equal(directWhatsAppLink(bad),'');
});
test('legacy destinations survive unrelated edits and new numbers explicitly replace both fields',()=>{
 const legacy={whatsapp:'50255554444',whatsapp_link:'https://wa.me/message/ABC123xyz?text=Hola'};
 assert.equal(contactLink('whatsapp',cleanContent({...legacy,description:'New description'})),legacy.whatsapp_link);
 const number='+1 803 555 1234';const changed=cleanContent({...legacy,whatsapp:number,whatsapp_link:directWhatsAppLink(number)});
 assert.equal(contactLink('whatsapp',changed),'https://api.whatsapp.com/send?phone=18035551234');
 assert.equal(contactLink('whatsapp',{whatsapp:'50255554444',email:'',phone:''}),'https://wa.me/50255554444');
});
