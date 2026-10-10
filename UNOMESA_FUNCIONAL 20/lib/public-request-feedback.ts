/** Public messages never expose provider responses, keys or submitted guest data. */
export function publicRequestFeedback(status:number,code:unknown,en=false){
 const t=(es:string,eng:string)=>en?eng:es;
 if(status===429)return t('Espere cinco minutos antes de volver a intentar. Sus datos permanecen en el formulario.','Wait five minutes before retrying. Your details remain in the form.');
 if(code==='CAPTCHA')return t('No se pudo validar la verificación. Márquela de nuevo y vuelva a enviar; sus datos siguen aquí.','Verification could not be validated. Complete it again and resend; your details are still here.');
 if(code==='INVALID_ORIGIN')return t('Abra de nuevo el enlace público del restaurante en otra pestaña e intente allí. Conserve esta pestaña para copiar sus datos.','Open the restaurant’s public link again in another tab and try there. Keep this tab to copy your details.');
 if(code==='PUBLIC_NOT_FOUND')return t('El restaurante ya no está recibiendo solicitudes desde este enlace. Utilice sus opciones de contacto.','The restaurant is no longer accepting requests through this link. Use its contact options.');
 if(status>=500||code==='SERVICE_UNAVAILABLE')return t('El servicio de solicitudes no está disponible por el momento. Sus datos permanecen aquí. Intente más tarde o contacte al restaurante.','The request service is temporarily unavailable. Your details remain here. Try later or contact the restaurant.');
 if(status===400||status===413||code==='PUBLIC_INPUT')return t('Revise los campos obligatorios, teléfono con código de país, fecha, menú, salón y medio de contacto. Si el restaurante cambió sus opciones, abra su enlace en otra pestaña.','Check required fields, phone country code, date, menu, space and contact method. If the restaurant changed its options, open its link in another tab.');
 return t('No pudimos confirmar el envío. Compruebe la conexión y vuelva a intentar desde este formulario.','We could not confirm submission. Check your connection and retry from this form.');
}

/** PostgreSQL validation errors are distinct from service failures. */
export function publicSubmissionFailure(message:string){
 if(/PUBLIC_NOT_FOUND/.test(message))return {code:'PUBLIC_NOT_FOUND',status:404};
 if(/PUBLIC_INPUT/.test(message))return {code:'PUBLIC_INPUT',status:400};
 return {code:'SERVICE_UNAVAILABLE',status:503};
}
