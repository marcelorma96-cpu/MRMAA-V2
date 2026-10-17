const codes = new Set(['GOOGLE_NATIVE','GOOGLE_NATIVE_MISSING','GOOGLE_NATIVE_TIMEOUT','GOOGLE_CALLBACK_INVALID','GOOGLE_PROVIDER','GOOGLE_ATTEMPT_EXPIRED','GOOGLE_RETURN','GOOGLE_EXCHANGE','GOOGLE_PKCE_MISSING','GOOGLE_SESSION','GOOGLE_STORAGE','GOOGLE_NETWORK']);
export function googleErrorCode(error:unknown) {
  const code=error instanceof Error?error.message:'';
  return codes.has(code)?code:'GOOGLE_EXCHANGE';
}
export function googleErrorMessage(code:string,en:boolean) {
  if(code==='GOOGLE_PKCE_MISSING'||code==='GOOGLE_ATTEMPT_EXPIRED')return en?'This sign-in attempt expired. Start again with Continue with Google.':'Este intento de ingreso venció. Pulse Continuar con Google nuevamente.';
  if(code==='GOOGLE_STORAGE')return en?'Your session could not be saved on this device. Please try again.':'No se pudo guardar la sesión en este dispositivo. Intente nuevamente.';
  if(code==='GOOGLE_NETWORK')return en?'Check your connection and try Google again.':'Revise su conexión y vuelva a intentar con Google.';
  return en?'Google sign-in could not finish. Please try again.':'No se pudo completar el ingreso con Google. Intente nuevamente.';
}
export function googleErrorReference(code:string) {
  const build=typeof navigator==='undefined'?'':navigator.userAgent.match(/UnoMesa-(?:iOS|Android)\/[\d.]+/)?.[0];
  return `G13 · ${build||'web'} · ${code}`;
}
