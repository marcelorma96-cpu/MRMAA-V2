# Meta: visitas y registro

Píxel conservado: 1105508185670938. Se mantienen Vercel Analytics y sus eventos.

| Evento Meta | Momento |
| --- | --- |
| PageView | Visita a la landing pública |
| Registro_abierto | Abre el formulario de registro |
| Registro_intento | Intenta enviar el formulario |
| Registro_error | El formulario o servidor rechaza el intento |
| CompleteRegistration | /api/register responde correctamente con ok=true |

CompleteRegistration significa formulario aceptado; no acredita confirmación de correo, prueba activada ni compra. Se evita repetir esta conversión en el mismo documento del navegador. Una recarga inicia otro documento; no es deduplicación por cuenta. No se agregan Purchase ni StartTrial.

## Instalación

1. Desplegar esta carpeta como nueva versión del proyecto de Vercel que sirve mrmaa.com. No requiere SQL por esta actualización de analítica.
2. Se conserva el píxel existente. NEXT_PUBLIC_META_PIXEL_ENABLED=false desactiva toda su medición; si cambias una variable pública, vuelve a desplegar.
3. En Meta, abrir el píxel 1105508185670938 > Probar eventos. Abrir mrmaa.com y comprobar apertura e intento de registro. Para comprobar CompleteRegistration es necesario un registro aceptado real; los intentos inválidos no deben producirlo. No hace falta comprar.
4. Al configurar campañas orientadas a registros, seleccionar este píxel y CompleteRegistration como evento de conversión cuando esté disponible. Subir el ZIP no cambia automáticamente la configuración de tus anuncios.

## Alcance

Solo landing y formulario público, en mrmaa.com y www.mrmaa.com. No mide el dashboard, inicio de sesión, recuperación ni enlaces con tokens. No funciona en dominios de preview o localhost. Solo se transmiten nombres fijos de eventos; no enviamos campos del formulario, contraseñas, correos, teléfono, restaurante, CAPTCHA ni textos de error. No se activa coincidencia avanzada ni detección automática de formularios. Meta utiliza sus propios identificadores de navegador y atribución; esto no es una integración de Conversions API.

La medición es independiente de Vercel Analytics. Un bloqueador, error de red o salir del registro antes de cargar el píxel puede impedir el envío sin impedir el registro. Los eventos pendientes se descartan al salir del formulario. La confirmación final debe hacerse en Probar eventos después del despliegue; las pruebas locales no enviaron datos a Meta.

Validación: 24 pruebas automatizadas de Meta/Vercel aprobadas y TypeScript sin errores. Sin cambios en APIs, SQL, pagos, CAPTCHA, confirmación de correo, estilos ni horarios.

Referencia oficial: https://developers.facebook.com/docs/meta-pixel/reference/
