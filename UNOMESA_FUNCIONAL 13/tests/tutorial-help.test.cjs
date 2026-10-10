const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,cache={}){file=path.resolve(file);if(cache[file])return cache[file].exports;const module={exports:{}};cache[file]=module;const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(source,{module,exports:module.exports,Buffer,process:{env:{}},require:name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts'),cache):require(name)});return module.exports;}
const {TUTORIAL_GUIDE:guide}=load('lib/tutorial-guide.ts'),tour=load('lib/tutorial-tour.ts'),assistant=load('lib/assistant.ts');
test('quick tutorial has at most 7 short steps and retains full reference',()=>{
 assert(guide.length>=94);assert.equal(new Set(guide.map(topic=>topic.title)).size,guide.length);
 for(const language of ['es','en'])for(const plan of ['basic','intermediate','advanced'])for(const role of ['administrador','gerente','operacion','lectura']){
  const steps=tour.quickTutorial(language,plan,role,'activo');assert(steps.length>=5&&steps.length<=7);assert.equal(steps[0].id,'start');assert.equal(steps.at(-1).id,'help');
  for(const step of steps){assert.equal(step.details.length,3);assert(step.title&&step.text);assert(step.details.every(text=>text.length<=200));assert(tour.helpSections[step.guideSection]);}
  assert.equal(steps.some(step=>step.tab==='reports'),plan==='advanced'&&role==='administrador');assert.equal(steps.some(step=>step.tab==='schedules'),plan!=='basic');
  const words=steps.map(step=>[step.title,step.text,...step.details].join(' ')).join(' ').split(/\s+/).length;assert(words<600,words);
 }
});
test('read-only tour offers consultation and personal password, not editing instructions',()=>{
 for(const language of ['es','en']){
  const steps=tour.quickTutorial(language,'advanced','lectura','activo');
  assert(!steps.some(step=>step.tab==='reports'));
  const operational=steps.filter(step=>['quotes','reservations','schedules'].includes(step.tab)).flatMap(step=>step.details).join(' ');
  assert(!/Cree una|conviértala|asigne Turno|Create a quote|convert it to|assign Shift/.test(operational));
  assert(steps.find(step=>step.id==='account').details.join(' ').includes(language==='en'?'password':'contraseña'));
 }
});
test('guide filtering preserves role/plan access and recent topics',()=>{
 for(const language of ['es','en']){
  const basic=tour.availableHelpTopics(language,'basic',true),readonly=tour.availableHelpTopics(language,'advanced',false);
  assert(!basic.some(topic=>['schedules','reports'].includes(topic.tab)));assert(!readonly.some(topic=>topic.tab==='reports'));
  assert(readonly.some(topic=>topic.title===(language==='en'?'Create or change a password in Account':'Crear o cambiar contraseña desde Cuenta')));
  assert(basic.some(topic=>topic.title===(language==='en'?'Restaurant logo':'Logo del restaurante')));
 }
 assert(tour.availableHelpTopics('es','advanced',true).some(topic=>tour.helpMatches(topic,'como cambiar contrasena')));
 assert(tour.availableHelpTopics('en','advanced',true).some(topic=>tour.helpMatches(topic,'how can I change password')));
 assert.equal(tour.searchHelpTopics(tour.availableHelpTopics('en','advanced',true),'all','password')[0].title,'Create or change a password in Account');
 assert.equal(tour.searchHelpTopics(tour.availableHelpTopics('es','advanced',true),'all','contraseña')[0].title,'Crear o cambiar contraseña desde Cuenta');
});
test('guide documents all recent features in both languages without stale MFA restriction',()=>{
 const cases=[['Logo del restaurante',/Quitar imagen/,/Remove image/],['Registrarse e ingresar con Google',/10 días/,/10-day/],['Crear o cambiar contraseña desde Cuenta',/Confirmar nueva contraseña/,/Confirm new password/],['Confirmaciones flotantes de guardado',/5 segundos/,/5 seconds/],['Buscar cotizaciones y acciones de cada fila',/hora de creación/,/creation date and time/],['Contactar, No realizada y avisos ocultos',/Mostrar aviso/,/Show reminder/],['Convertir una cotización y abrir el vínculo',/recién creada/,/newly created/],['Catálogo de menús y productos: crear, editar y borrar',/5 filas/,/5 rows/],['Estilo, tipografía y colores de cotización',/datos de ejemplo/,/sample data/],['Reporte de horas programadas y comidas',/vacaciones/,/vacation/],['Filtros, búsqueda, Excel e impresión de reportes',/importes numéricos/,/numeric amounts/]];
 for(const [title,es,en] of cases){const topic=guide.find(topic=>topic.title===title);assert(topic,title);assert.match(topic.details.join(' '),es,title);assert.match(topic.detailsEn.join(' '),en,title)}
 const codes=guide.find(topic=>topic.title==='Códigos por email: activar, reenviar y desactivar');assert.match(codes.details[0],/contraseña o con Google/);assert.match(codes.detailsEn[0],/password or Google/);
});
test('assistant retrieves password, Google, logos and revised report criteria as reference',()=>{
 const cases=[['¿Cómo creo contraseña si entré con Google?','settings','Crear o cambiar contraseña desde Cuenta'],['How do I create a password after Google sign in?','settings','Crear o cambiar contraseña desde Cuenta'],['¿Cómo quito el logo?','settings','Logo del restaurante'],['¿Los dos pasos funcionan con Google?','settings','Verificación en dos pasos'],['¿Por qué las vacaciones no suman horas en reportes?','reports','Reporte de horas programadas y comidas'],['¿Excel incluye todas las filas y montos numéricos del reporte?','reports','Filtros, búsqueda, Excel e impresión de reportes']];
 for(const [question,page,title] of cases){const top=assistant.rankHelpTopics(question,[],page).slice(0,8);assert(top.some(item=>item.topic.title===title),question);const prompt=assistant.helpInstructions(question,[],'es','advanced','administrador',page);assert(prompt.includes(title),question);assert(Buffer.byteLength(prompt)+Buffer.byteLength(question)<18000)}
});
test('assistant responses remain bounded, supported and separate from actual restaurant data',()=>{
 const prompt=assistant.helpInstructions('Ayuda con mi cuenta',[],'es','advanced','lectura','settings');assert(prompt.includes('2–4 short'));assert(prompt.includes('140 words'));assert(prompt.includes('at most 7'));assert(prompt.includes('cannot read business records'));assert(prompt.includes('role=lectura'));assert(prompt.includes('Google does not bypass'));
});

test('floor help explains agenda, booking routes and tentative quote proposals',()=>{
 const pairs=[['¿Cómo veo las reservaciones de una mesa y si todo el salón está reservado?','reservations','Agenda por mesa, salón reservado y nueva reservación'],['How do quote table proposals become reserved?','quotes','Cotizaciones conectadas con mesas y salón completo']];
 for(const [question,page,title] of pairs){assert(assistant.rankHelpTopics(question,[],page).slice(0,5).some(x=>x.topic.title===title));assert(assistant.helpInstructions(question,[],'es','advanced','administrador',page).includes(title));}
 const doc=guide.find(x=>x.title==='Cotizaciones conectadas con mesas y salón completo');assert(doc.details.join(' ').includes('no bloquea'));assert(doc.detailsEn.join(' ').includes('does not block'));
});

test('new public-page and billing questions retrieve usable instructions in either language',()=>{
 const cases=[
  ['¿Cómo publico mi enlace y recibo solicitudes?','settings','Página pública, menús y buzón'],
  ['How do I publish my restaurant link and receive requests?','settings','Página pública, menús y buzón'],
  ['¿Cómo convierto una solicitud del buzón en cotización?','inbox','Buzón: atender solicitudes y crear cotizaciones'],
  ['How can I create a quote from an inbox request?','inbox','Buzón: atender solicitudes y crear cotizaciones'],
  ['¿Puedo subir el menú completo en PDF?','settings','Menú digital, fotos y PDF públicos'],
  ['How do I upload a PDF menu?','settings','Menú digital, fotos y PDF públicos'],
  ['¿Cada restaurante tiene su enlace y datos separados?','settings','Enlace personalizado, QR y datos de cada restaurante'],
  ['¿Cómo regreso a la app después de pagar en Lemon Squeezy?','settings','Volver a UnoMesa después de pagar o gestionar un plan'],
  ['How do I return to the app after payment?','settings','Volver a UnoMesa después de pagar o gestionar un plan'],
  ['¿Qué pasa con recordatorios si ya pasó la fecha del evento?','quotes','Pendientes y recordatorios del evento'],
 ];
 for(const [question,page,title] of cases){
  const topic=guide.find(x=>x.title===title);assert(topic,title);
  assert(assistant.rankHelpTopics(question,[],page).slice(0,5).some(x=>x.topic===topic||x.topic.title===title),question);
  for(const language of ['es','en']){
   const prompt=assistant.helpInstructions(question,[],language,'basic','lectura',page);
   assert(prompt.includes(language==='en'?topic.titleEn:topic.title),`${language}: ${question}`);
   assert(Buffer.byteLength(prompt)+Buffer.byteLength(question)<18000);
  }
 }
});

test('inbox is a reachable help section, including read-only accounts, with explicit limits',()=>{
 for(const language of ['es','en']){
  const topics=tour.availableHelpTopics(language,'basic',false);
  const inbox=tour.searchHelpTopics(topics,'inbox','');assert(inbox.length>0);
  assert(inbox.every(topic=>topic.tab==='inbox'));
  assert(inbox[0].details.some(detail=>detail.includes(language==='en'?'Read-only':'Solo lectura')));
 }
 const prompt=assistant.helpInstructions('Public page payments and booking requests',[],'en','basic','lectura','inbox');
 assert(prompt.includes('navigation hint: inbox'));
 assert(prompt.includes('No customer deposits'));
 assert(prompt.includes('not payment proof'));
 assert(prompt.includes('cannot read business records'));
 assert(prompt.includes('Never promise Google ranking'));
});
