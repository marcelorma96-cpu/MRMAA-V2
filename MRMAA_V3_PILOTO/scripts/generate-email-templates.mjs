import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../supabase-email-templates/", import.meta.url));
mkdirSync(directory, { recursive: true });
const messages = {
  invite: {
    dashboard: "Invite user",
    es: ["Invitación de acceso", "Le han invitado a MRMAA", "Utilice el siguiente botón para aceptar la invitación y crear su contraseña.", "Crear mi contraseña"],
    en: ["Account invitation", "You have been invited to MRMAA", "Use the button below to accept your invitation and create your password.", "Create my password"],
  },
  confirmation: {
    dashboard: "Confirm sign up",
    es: ["Confirme su correo", "Confirme su correo electrónico", "Confirme su dirección para completar el registro de su cuenta en MRMAA.", "Confirmar mi correo"],
    en: ["Confirm your email", "Confirm your email address", "Confirm your email address to complete your MRMAA account registration.", "Confirm my email"],
  },
  recovery: {
    dashboard: "Reset password",
    es: ["Restablecer contraseña", "Restablezca su contraseña", "Recibimos una solicitud para restablecer la contraseña de su cuenta en MRMAA.", "Restablecer mi contraseña"],
    en: ["Reset your password", "Reset your password", "We received a request to reset the password for your MRMAA account.", "Reset my password"],
  },
  email_change: {
    dashboard: "Change email address",
    es: ["Confirme el cambio de correo", "Confirme el cambio de correo electrónico", "Se solicitó cambiar el correo de acceso de su cuenta en MRMAA. Confirme la solicitud con el siguiente botón.", "Confirmar cambio de correo"],
    en: ["Confirm your email change", "Confirm your email address change", "A request was made to change the sign-in email for your MRMAA account. Confirm the request using the button below.", "Confirm email change"],
  },
  magic_link: {
    dashboard: "Magic link",
    es: ["Enlace de acceso", "Acceda a MRMAA", "Utilice el siguiente botón para iniciar sesión en su cuenta.", "Iniciar sesión"],
    en: ["Sign-in link", "Sign in to MRMAA", "Use the button below to sign in to your account.", "Sign in"],
  },
  reauthentication: {
    dashboard: "Reauthentication",
    es: ["Código de verificación", "Verifique su identidad", "Introduzca este código en MRMAA para confirmar la operación. No comparta este código con nadie.", ""],
    en: ["Verification code", "Verify your identity", "Enter this code in MRMAA to confirm the action. Do not share this code with anyone.", ""],
  },
  password_changed: {
    dashboard: "Password changed",
    es: ["Su contraseña ha cambiado", "Contraseña actualizada", "Se cambió la contraseña de su cuenta en MRMAA. Si no realizó este cambio, restablezca su contraseña desde mrmaa.com y contacte a support@mrmaa.com.", ""],
    en: ["Your password has changed", "Password updated", "The password for your MRMAA account was changed. If you did not make this change, reset your password at mrmaa.com and contact support@mrmaa.com.", ""],
  },
  email_changed: {
    dashboard: "Email address changed",
    es: ["Su correo de acceso ha cambiado", "Correo de acceso actualizado", "Se cambió el correo de acceso de su cuenta en MRMAA. Si no realizó este cambio, contacte a support@mrmaa.com.", ""],
    en: ["Your sign-in email has changed", "Sign-in email updated", "The sign-in email for your MRMAA account was changed. If you did not make this change, contact support@mrmaa.com.", ""],
  },
};

// printf makes unknown, null, and malformed metadata safe to compare.
const prefix = '{{ $language := "" }}{{ with .Data }}{{ $language = printf "%v" .language }}{{ end }}';
const translated = (values) => `{{ if eq $language "en" }}${values.en}{{ else }}${values.es}{{ end }}`;
const content = (key, index) => {
  const values = Object.fromEntries(["es", "en"].map((lang) => [lang, messages[key][lang][index]]));
  if (key !== "recovery") return translated(values);
  // MRMAA uses a recovery link when re-sending an invitation. This flag
  // changes wording only; Supabase still creates and validates the link.
  const inviteValues = Object.fromEntries(["es", "en"].map((lang) => [lang, messages.invite[lang][index]]));
  return `{{ if eq .RedirectTo "https://mrmaa.com/?invite=1" }}${translated(inviteValues)}{{ else }}${translated(values)}{{ end }}`;
};
const languageAttribute = translated({ es: "es", en: "en" });
const ignore = translated({
  es: "Si no esperaba este mensaje, puede ignorarlo. No comparta este enlace.",
  en: "If you were not expecting this email, you can ignore it. Do not share this link.",
});
const help = translated({ es: "¿Necesita ayuda?", en: "Need help?" });
const catalog = [];
for (const [key, message] of Object.entries(messages)) {
  const isLink = Boolean(message.es[3]);
  const subject = `${prefix}MRMAA | ${content(key, 0)}`;
  const action = isLink
    ? `<p style="margin:28px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold">${content(key, 3)}</a></p><p style="font-size:13px;color:#52525b">${ignore}</p>`
    : key === "reauthentication" ? '<p style="font-size:30px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>' : "";
  const body = `${prefix}
<!doctype html>
<html lang="${languageAttribute}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MRMAA</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f4f5;color:#18181b;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" style="width:100%;max-width:580px;margin:0 auto;border-collapse:collapse;background:#ffffff">
<tr><td style="padding:28px 24px;border-top:5px solid #ea580c">
<p style="color:#ea580c;font-size:24px;font-weight:bold;margin:0 0 24px">MRMAA</p>
<h1 style="font-size:24px;line-height:1.3;margin:0 0 18px">${content(key, 1)}</h1>
<p style="font-size:16px;line-height:1.6">${content(key, 2)}</p>
${action}
<hr style="border:0;border-top:1px solid #e4e4e7;margin:28px 0 18px">
<p style="font-size:13px;line-height:1.5;color:#52525b">${help} <a href="mailto:support@mrmaa.com" style="color:#c2410c">support@mrmaa.com</a></p>
</td></tr></table>
</body></html>
`;
  writeFileSync(`${directory}${key}.subject.txt`, subject);
  writeFileSync(`${directory}${key}.html`, body);
  catalog.push({ key, dashboard: message.dashboard, subject, body });
}
writeFileSync(`${directory}templates.json`, JSON.stringify(catalog, null, 2) + "\n");
console.log(`Preparadas ${catalog.length} plantillas en español e inglés.`);
