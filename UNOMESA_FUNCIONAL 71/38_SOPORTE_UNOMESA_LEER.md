# Soporte UnoMesa

1. Ejecute completo 37_ACTIVAR_SOPORTE_UNOMESA.sql en el proyecto de Supabase revisado. Comprueba los IDs de ambas cuentas, traslada las solicitudes sin ampliar permisos ni vencimientos y deshabilita el agente anterior. La función de acceso admite únicamente la cuenta nueva. Conserva las cuentas Auth y el historial; no elimina datos de restaurantes.
2. En Vercel Production configure UNOMESA_PASSCODE_FROM como UnoMesa <passcode@unomesa.com> y UNOMESA_SUPPORT_FROM como UnoMesa <support@unomesa.com>. El proveedor SMTP debe autorizar esos remitentes. Ya no se usa MRMAA_SMTP_FROM como alternativa.
3. MRMAA_SMTP_HOST, MRMAA_SMTP_PORT, MRMAA_SMTP_USER y MRMAA_SMTP_PASSWORD conservan sus nombres técnicos. Si el usuario SMTP es el buzón anterior, sustitúyalo por las credenciales válidas del nuevo proveedor/buzón; no cambie solo la dirección conservando una contraseña incompatible. No comparta contraseñas en el chat.
4. Despliegue esta carpeta y los cambios de variables. Cierre la sesión e ingrese con support@unomesa.com. Espere el intervalo si hubo intentos recientes.
5. Compruebe: código recibido, acceso al panel, nueva solicitud de restaurante y aviso recibido, apertura solo con autorización temporal, resolución y aviso al cliente. El correo anterior debe quedar sin acceso de soporte.

El mensaje de espera no demuestra que el proveedor haya entregado el correo. Ahora permite introducir un código pendiente y muestra una cuenta regresiva. Si falla SMTP aparece un error de envío específico; en Vercel busque unomesa.security.email. Los logs no incluyen códigos, contraseñas ni cuerpo del correo.

Los buzones/DNS/SMTP externos y las plantillas de Authentication de Supabase se configuran fuera del ZIP. El código de dos pasos lo envía la app, no la plantilla de confirmación de Supabase. No se ha comprobado una entrega real desde este entorno.
