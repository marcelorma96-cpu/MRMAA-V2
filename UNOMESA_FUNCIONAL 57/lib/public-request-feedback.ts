/** Public messages never expose provider responses, keys or submitted guest data. */
export function publicRequestFeedback(status:number,code:unknown,en=false){
 const t=(es:string,eng:string)=>en?eng:es;
 const fields:Record<string,[string,string]>={
  PUBLIC_NAME:['Escriba su nombre (máximo 160 caracteres).','Enter your name (up to 160 characters).'],
  PUBLIC_PHONE:['Revise el teléfono: seleccione su país e ingrese el número completo.','Check your phone: select your country and enter the complete number.'],
  PUBLIC_EMAIL:['Revise el correo electrónico; por ejemplo, nombre@correo.com.','Check your email address; for example, name@example.com.'],
  PUBLIC_DATE:['Seleccione una fecha válida para el evento.','Select a valid event date.'],
  PUBLIC_DATE_RANGE:['Revise la fecha del evento: no puede ser anterior a ayer ni estar a más de cinco años.','Check the event date: it cannot be earlier than yesterday or more than five years ahead.'],
  PUBLIC_TIME:['Seleccione la hora del evento, con horas y minutos.','Select the event time, including hours and minutes.'],
  PUBLIC_GUESTS:['Ingrese una cantidad de personas entre 1 y 100000, sin decimales.','Enter a whole number of guests between 1 and 100000.'],
  PUBLIC_MENU:['Elija un menú disponible o «Necesito asesoría». Si cambió el menú, abra el enlace actualizado en otra pestaña.','Choose an available menu or “I would like advice”. If the menu changed, open the updated link in another tab.'],
  PUBLIC_AREA:['Revise el salón elegido o seleccione «Sin preferencia». Si cambiaron los salones, abra el enlace actualizado en otra pestaña.','Check your selected space or select “No preference”. If the spaces changed, open the updated link in another tab.'],
  PUBLIC_PREFERENCE:['Seleccione un medio de contacto disponible. Si el restaurante cambió sus opciones, abra el enlace actualizado en otra pestaña.','Select an available contact method. If the restaurant changed its options, open the updated link in another tab.'],
  PUBLIC_NOTES:['Acorte los detalles o preguntas a un máximo de 2000 caracteres.','Shorten your details or questions to 2000 characters or fewer.'],
 };
 const field=typeof code==='string'?fields[code]:undefined;if(field)return t(...field);
 if(status===429)return t('Espere cinco minutos antes de volver a intentar. Sus datos permanecen en el formulario.','Wait five minutes before retrying. Your details remain in the form.');
 if(code==='CAPTCHA_UNAVAILABLE')return t('La verificación de seguridad no pudo completarse. Sus datos permanecen aquí. Intente nuevamente en un momento o contacte al restaurante.','Security verification could not be completed. Your details remain here. Try again shortly or contact the restaurant.');
 if(code==='CAPTCHA')return t('No se pudo validar la verificación. Márquela de nuevo y vuelva a enviar; sus datos siguen aquí.','Verification could not be validated. Complete it again and resend; your details are still here.');
 if(code==='INVALID_ORIGIN')return t('Abra de nuevo el enlace público del restaurante en otra pestaña e intente allí. Conserve esta pestaña para copiar sus datos.','Open the restaurant’s public link again in another tab and try there. Keep this tab to copy your details.');
 if(code==='PUBLIC_NOT_FOUND')return t('El restaurante ya no está recibiendo solicitudes desde este enlace. Utilice sus opciones de contacto.','The restaurant is no longer accepting requests through this link. Use its contact options.');
 if(status>=500||code==='SERVICE_UNAVAILABLE')return t('El servicio de solicitudes no está disponible por el momento. Sus datos permanecen aquí. Intente más tarde o contacte al restaurante.','The request service is temporarily unavailable. Your details remain here. Try later or contact the restaurant.');
 if(status===400||status===413||code==='PUBLIC_INPUT')return t('No se pudo validar la solicitud. Sus datos siguen aquí. Si el problema continúa, contacte al restaurante e indique la referencia que aparece abajo.','The request could not be validated. Your details are still here. If the problem continues, contact the restaurant and provide the reference below.');
 return t('No pudimos confirmar el envío. Compruebe la conexión y vuelva a intentar desde este formulario.','We could not confirm submission. Check your connection and retry from this form.');
}

/** PostgreSQL validation errors are distinct from service failures. */
export function publicSubmissionFailure(message:string){
 if(/PUBLIC_NOT_FOUND/.test(message))return {code:'PUBLIC_NOT_FOUND',status:404};
 if(/PUBLIC_INPUT/.test(message))return {code:'PUBLIC_INPUT',status:400};
 return {code:'SERVICE_UNAVAILABLE',status:503};
}
