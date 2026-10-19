# Ingreso y registro con Google · UnoMesa

Esta actualización agrega **Continuar con Google / Continue with Google** a Iniciar sesión y Crear cuenta. El botón permanece oculto hasta activar `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` y volver a desplegar.

## Activación, en este orden

1. **Supabase → SQL Editor:** ejecute `40_REGISTRO_GOOGLE.sql` si aún no lo ha aplicado; después ejecute completo **`41_GOOGLE_ACCESO_DIRECTO.sql`**. Ambos son incrementales y reejecutables. No vuelva a ejecutar la instalación base. Requieren la instalación existente y las sesiones del SQL 33. El SQL 41 agrega una función de servidor para crear cuentas nuevas sin pedir los datos del restaurante; no actualiza ni elimina cuentas existentes.
2. **Google Auth Platform:** cree/seleccione un proyecto para UnoMesa. Configure Audience para usuarios externos, Branding con el nombre UnoMesa, su logo, `https://unomesa.com`, `https://unomesa.com/privacidad`, `https://unomesa.com/terminos` y el correo de soporte. Use solamente los permisos de identidad `openid`, correo y perfil.
3. En **Clients**, cree un cliente OAuth de tipo **Web application**. Añada como orígenes JavaScript `https://unomesa.com` y `https://www.unomesa.com` si ambos sirven la aplicación. En **Authorized redirect URIs** pegue la **Callback URL que muestra Supabase → Authentication → Sign In / Providers → Google**. Es la URL de Supabase terminada en `/auth/v1/callback`; aquí no va `/auth/google`.
4. Copie el **Client ID** y **Client secret** de Google en ese proveedor Google de Supabase y actívelo. El secreto se guarda en Supabase, no en variables `NEXT_PUBLIC_*` ni en el repositorio.
5. En **Supabase → Authentication → URL Configuration → Redirect URLs**, agregue las direcciones de regreso de la aplicación:
   - `https://unomesa.com/auth/google`
   - `https://www.unomesa.com/auth/google`
   Si MRMAA todavía sirve directamente la aplicación, agregue también `https://mrmaa.com/auth/google` y `https://www.mrmaa.com/auth/google`. Si esos dominios ya redirigen a UnoMesa antes del ingreso, use el dominio final. Para probar otro proyecto Vercel agregue su URL exacta terminada en `/auth/google`.
6. En **Vercel → Environment Variables**, agregue `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` con el valor `true` al entorno que vaya a probar. Haga un nuevo deployment. Un cambio de variable por sí solo no modifica un deployment existente.
7. Pruebe con los usuarios de prueba autorizados de Google. Antes de ofrecerlo a todos, compruebe la audiencia/publicación de Google y cualquier verificación de marca solicitada.

Las URLs de regreso deben conservar el mismo dominio y la misma pestaña donde se inició Google: no redirija `/auth/google` entre `www` y el dominio sin `www`. El intercambio seguro necesita el dato temporal guardado en ese navegador.

## Comportamiento

- **Cuenta nueva:** pulsa Continuar con Google, elige su cuenta y entra directamente al dashboard con **10 días de Advanced gratis**, sin tarjeta ni formulario intermedio. Se usa el nombre disponible en Google para el administrador y un nombre provisional “Mi restaurante” / “My restaurant”. No se inventan teléfono ni dirección. Puede completar los datos en Configuración → General.
- **Inicio rápido también está incluido para Google:** aparece una tarjeta visible en el dashboard mientras no se complete. Permite crear el área de empleados, el primer empleado, un turno, el área de eventos y el primer producto con su precio. Al guardar ofrece Crear cotización, Crear reservación o Asignar horario. Puede cerrarlo y retomarlo desde la misma tarjeta o desde Ayuda; no bloquea el acceso al dashboard.
- Los enlaces de términos y privacidad aparecen junto al botón Google. La aceptación corresponde a pulsar ese botón; no se añade un checkbox ni una pantalla en el recorrido normal. Si el navegador pierde el dato temporal o pasa más de una hora, pide solo Continuar al dashboard junto a los mismos enlaces; nunca exige completar un formulario de negocio.
- Una cuenta existente vinculada por Supabase entra al mismo restaurante y conserva sus permisos, plan y fechas. Supabase gestiona la vinculación de identidades; este código nunca combina cuentas por un correo escrito en el formulario.
- Una invitación pendiente debe completarse con su enlace original. Un miembro inactivo no se reactiva con Google. Un registro por correo que quedó incompleto debe finalizar por su flujo original.
- Si está activa la verificación por correo, el código sigue siendo obligatorio después de Google. El acceso de soporte conserva su exigencia de contraseña y código. Los cambios de correo también mantienen la verificación actual que exige contraseña; una cuenta creada solo con Google puede establecerla usando la recuperación de contraseña existente.
- El país ajusta el idioma y la moneda sugeridos: Guatemala GTQ, México MXN y Estados Unidos USD. Se mantienen las preferencias y opciones actuales de UnoMesa.
- El ingreso por correo/contraseña, sus dos campos de contraseña al registrarse, Turnstile, enlaces de confirmación y recuperación permanecen disponibles. Google usa la verificación del proveedor y un límite de intentos al completar el restaurante.
- Reintentar la finalización no duplica restaurantes ni reinicia la prueba. Si falla la conexión, la cuenta se conserva para reintentar.

## Comprobación antes de activar en producción

1. Cuenta de Google nueva: debe entrar al dashboard sin formulario; verificar país/moneda sugeridos y prueba Advanced de 10 días. Abrir Inicio rápido, guardar los registros y comprobar que siguen disponibles tras recargar.
   Completar el nombre y datos en Configuración → General cuando se desee.
2. Cuenta existente con plan pagado y el mismo correo vinculado: debe conservar su restaurante y plan, sin nueva prueba.
3. Cuenta con verificación adicional: debe pedir y validar el código antes del dashboard.
4. Cuenta invitada pendiente/inactiva: no debe crear un restaurante ni conseguir acceso nuevo.
5. Cancelar Google y reintentar; probar móvil y computadora.
6. Verificar que correo/contraseña, confirmación, recuperación y una invitación sigan funcionando en el proyecto desplegado.

Verificación local de esta entrega: compilación de producción y TypeScript; pruebas de API, SQL con PostgreSQL embebido y regresiones de autenticación/analíticas. Las pruebas de SQL comprueban diez días exactos, reintentos sin duplicar, rechazo de sesiones revocadas/invitaciones inactivas, permisos exclusivos del servidor y conservación de cuentas pagadas y exentas del piloto. Pasaron 49 pruebas automatizadas. Además se verificó el flujo real de pantallas con respuestas simuladas: español en computadora, inglés en móvil, creación sin formulario intermedio, Inicio rápido con guardado, cuenta existente sin nueva prueba y reintento después de un error. Esta simulación no sustituye la prueba de autorización real con su proyecto de Google. La autorización real de Google y la entrega del código de correo deben comprobarse después de configurar su proyecto. Si hay hooks personalizados en Supabase que restringen nuevos usuarios, también deben permitir el flujo autorizado de Google; este paquete no elimina esas restricciones.

Para retirar el botón, quite la variable o cámbiela a `false` y vuelva a desplegar. No borre cuentas ni restaurantes. Las funciones SQL pueden permanecer instaladas.

## Referencia y archivos

- Documentación oficial de [clientes OAuth de Google](https://support.google.com/cloud/answer/15549257), [Google en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow) y [vinculación de identidades](https://supabase.com/docs/guides/auth/auth-identity-linking).
- Icono G oficial: [Google Identity](https://developers.google.com/identity/branding-guidelines); recurso local `public/brand/google-g.png`.
- Pruebas del servidor y SQL: `node tests/google-auth.test.cjs` después de instalar las dependencias del proyecto.

El ZIP mantiene la carpeta `MRMAA_PRUEBAS 26` para conservar la ruta de despliegue existente. Incluye las mejoras anteriores de horarios, empleados, cotizaciones, sesiones y pagos.


## Lo que requiere configuración externa

El ZIP prepara el código, pero no configura ni activa su proyecto de Google, Supabase o Vercel. El ingreso real con Google debe probarse después de seguir los pasos anteriores. Mantenga el botón desactivado hasta instalar el SQL y configurar las URLs. No comparta el Client secret en el chat ni lo agregue a GitHub.
