# Activar «Continuar con Apple» en UnoMesa
El botón aparece junto a Google en el inicio de sesión y registro de la app de iPhone y iPad. Un iPhone usando Safari ve el ingreso web habitual. Android y los navegadores no necesitan una actualización. El cambio requiere activar el proveedor, desplegar el servidor y compilar la app con la misma cuenta de Apple Developer que publicó el build 26.

## 1. Configurar Apple Developer
En Certificates, Identifiers & Profiles → Identifiers, abre el App ID explícito `com.unomesa.app`. Activa **Sign in with Apple** y configúralo como App ID principal si aún no pertenece a un grupo. Conserva el equipo y cualquier grupo ya utilizado por la app. En **Keys**, crea una clave de **Sign in with Apple** asociada a ese App ID. Guarda su archivo privado .p8, el Key ID y el Team ID. Esta no es la clave de compras dentro de la app. Este flujo nativo no requiere registrar un sitio web con Services ID.

Para que lleguen los correos de UnoMesa a quien elija **Ocultar mi correo**, registra los dominios o remitentes que realmente envían sus mensajes (incluidos los códigos de acceso) en Certificates, Identifiers & Profiles → Services → Sign in with Apple for Email Communication. Verifica la autenticación del remitente con tu proveedor de correo. Prueba la entrega en una dirección de retransmisión real.

## 2. Configurar el proyecto existente de Supabase
En Authentication → Sign In / Providers → Apple, habilita el proveedor y agrega **com.unomesa.app** a los Client IDs autorizados. Deja **Skip nonce checks** desactivado. En SQL Editor ejecuta solo **64_INGRESO_APPLE.sql**, incluido en UNOMESA_FUNCIONAL. Es incremental y se apoya en las funciones existentes de Google y de sesiones; si faltan, detente y revisa la instalación en lugar de reinstalar la base de datos.

## 3. Desplegar el código de UNOMESA_FUNCIONAL
En Vercel → proyecto de UnoMesa → Settings → Environment Variables, configura el entorno correspondiente. No incluyas las claves en el código ni las compartas por chat.

| Variable | Valor |
| --- | --- |
| NEXT_PUBLIC_APPLE_AUTH_ENABLED | true, para que la nueva app ofrezca Apple |
| APPLE_LOGIN_TEAM_ID | Team ID de tu cuenta de Apple Developer |
| APPLE_LOGIN_KEY_ID | Key ID de la clave de Sign in with Apple |
| APPLE_LOGIN_PRIVATE_KEY | Contenido completo de la clave privada .p8, con encabezado y pie |
| APPLE_LOGIN_GRANT_KEY | Clave privada aleatoria de 32 bytes en Base64. Genera una sola vez con `openssl rand -base64 32`; guárdala en tu gestor de secretos. |

Conserva las variables existentes de Supabase y el CRON_SECRET del mantenimiento. No cambies APPLE_LOGIN_GRANT_KEY entre despliegues: protege los permisos guardados para revocarlos cuando se elimine la cuenta de acceso. Despliega el código actualizado después de configurar las variables; el indicador público se incorpora al compilar. No actives Google OAuth en otras plataformas como parte de este cambio.

## 4. Aplicar a tu build 26 desde una Mac
La copia de referencia disponible estaba en build 24. Apple revisó el 26. Para conservar cualquier cambio que hiciste después del 24, **trabaja sobre una copia del proyecto real del 26**:

1. Descomprime UNOMESA_iOS.zip y ejecuta **Aplicar_Apple_a_mi_proyecto.command**. Selecciona la carpeta del proyecto real que contiene UnoMesa.xcodeproj. Necesita Python 3. Como alternativa desde Terminal: `bash "/ruta/Aplicar_Apple_a_mi_proyecto.command" "/ruta/al/proyecto-del-26"`.
2. La herramienta crea una carpeta hermana terminada en **-AppleLogin**. El original queda intacto. Abre el proyecto de la copia, selecciona el target UnoMesa y en **Signing & Capabilities → + Capability** agrega **Sign in with Apple**. Comprueba que el Team y el Bundle ID sean los mismos del build 26. Si usas firma manual, regenera el perfil de distribución para incluir la capacidad.
3. En **General → Identity**, conserva la versión 1.0 y cambia **Build** a 27 (o al siguiente número libre). Compila y sube el nuevo build a TestFlight.
4. Si la herramienta avisa que la estructura es distinta, abre una copia del proyecto actual en Xcode: añade **UnoMesa/AppleSignInBridge.swift** al target de UnoMesa y, en BrowserController.swift, registra el puente junto al registro existente de `unomesa`, antes de crear el WKWebView:
   ```swift
   config.userContentController.addScriptMessageHandler(AppleSignInBridge { [weak self] in self?.web }, contentWorld: .page, name: "unoMesaApple")
   ```
   Adapta el nombre de la propiedad web si cambió. Añade la capacidad y sube el número de build como se indicó arriba. Si ya ejecutaste la herramienta con éxito, no añadas el Swift por segunda vez.

## 5. Verificar antes de reenviar
En el build firmado de TestFlight prueba en iPhone y iPad: registro nuevo con **Ocultar mi correo** sin pedir después el correo real, recepción del código de UnoMesa si lo solicita, cerrar sesión y entrar otra vez con la misma cuenta Apple, y cancelar el panel antes de autorizar. Confirma que un usuario habitual de Google sigue entrando a su restaurante y que Safari y Android conservan su pantalla habitual. Si un cliente existente de Google usa un correo privado de Apple distinto, que siga usando su método original para entrar al restaurante existente: no se unen automáticamente dos identidades por su nombre.

Cuando funcione, en App Store Connect selecciona el nuevo build para la ficha existente de UnoMesa 1.0. Puedes indicar a App Review: *In build [number], open UnoMesa on iPhone or iPad and tap Continue with Apple on the sign-in screen, next to Continue with Google. The native Apple sign-in sheet supports Hide My Email.* Sustituye [number] por el build que probaste.

Referencias: [Apple, regla 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services) · [Supabase, Sign in with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) · [Apple, correo privado](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/).
