require('tsx/cjs');
const {test}=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {QuickSetup}=require('../components/quick-setup.tsx');
function render(overrides={},state={}){
 const controller={available:true,open:false,progress:null,saving:false,error:false,start(){},move(){},finish:async()=>true,close(){},...state};
 return renderToStaticMarkup(React.createElement(QuickSetup,{en:false,plan:'advanced',role:'administrador',status:'activo',controller,offer:true,onNavigate:()=>true,onCompleted(){},...overrides}));
}
test('initial invitation is optional and never opens a modal or requires setup fields',()=>{
 const html=render();assert.match(html,/Empezar inicio rápido/);assert.match(html,/Omitir/);assert(!html.includes('aria-modal'));assert(!/<form|<input|<textarea/.test(html));assert(!html.includes('quickStartActive'));
});
test('dismissed invitation and completed card are hidden; explicitly resumed tour remains available',()=>{
 assert.equal(render({}, {progress:{status:'dismissed',step:'quotes',updatedAt:1}}),'');
 assert.equal(render({}, {available:false,open:true}),'');
 assert.match(render({}, {open:true,progress:{status:'dismissed',step:'quotes',updatedAt:1}}),/De propuesta a reservación/);
});
test('final step offers completion in both languages and plan downgrade never exposes reports',()=>{
 const progress={status:'active',step:'reports',updatedAt:1};
 assert.match(render({}, {open:true,progress}),/Finalizar inicio rápido/);
 assert.match(render({en:true}, {open:true,progress}),/Finish quick start/);
 const downgraded=render({plan:'basic'},{open:true,progress});assert(!downgraded.includes('Ver reportes'));assert.match(downgraded,/Sus reservas, en orden/);
});
test('failed persistence remains visible with retry guidance and an exit',()=>{
 const html=render({}, {open:true,error:true});assert.match(html,/role="alert"/);assert.match(html,/Cerrar por ahora/);assert.match(html,/Cerrar inicio rápido/);
});
