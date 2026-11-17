// Stable codes only: raw provider messages may contain personal data.
export function registrationFailure(error: { code?: string; status?: number; name?: string } | null) {
 const code=error?.code || '';
 if (code==='captcha_failed') return {code:'CAPTCHA_FAILED',status:400,wait:0,message:'No se pudo validar la verificación de seguridad. Complétela de nuevo e intente otra vez.'};
 if (code==='over_email_send_rate_limit'||code==='over_request_rate_limit'||error?.status===429)
  return {code:'EMAIL_RATE_LIMIT',status:429,wait:120,message:'Se alcanzó el límite temporal de envíos. Espere dos minutos antes de reintentar.'};
 if (code==='email_address_not_authorized') return {code:'EMAIL_SERVICE_CONFIGURATION',status:503,wait:60,message:'El servicio de correo no permite enviar la confirmación a esta dirección. Contacte a soporte de UnoMesa; no necesita volver a crear su cuenta.'};
 if (['email_exists','user_already_exists'].includes(code)) return {code:'ACCOUNT_EXISTS',status:409,wait:0,message:'Esta cuenta ya está registrada. Inicie sesión o recupere su contraseña.'};
 if (code==='email_address_invalid'||code==='validation_failed') return {code:'REGISTRATION_DATA',status:400,wait:0,message:'Revise el correo y los datos de registro e intente nuevamente.'};
 if (code==='weak_password') return {code:'WEAK_PASSWORD',status:400,wait:0,message:'Esta contraseña no es suficientemente segura. Elija una contraseña diferente.'};
 if (code==='signup_disabled'||code==='email_provider_disabled') return {code:'REGISTRATION_DISABLED',status:503,wait:60,message:'El registro con correo no está disponible en este momento. Contacte a soporte de UnoMesa.'};
 return {code:'REGISTRATION_DELIVERY_FAILED',status:503,wait:90,message:'No pudimos confirmar el envío del correo. Espere un momento y vuelva a intentarlo. Si continúa, contacte a soporte de UnoMesa.'};
}
