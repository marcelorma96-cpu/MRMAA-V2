# UnoMesa — demo interactiva sin registro

## Qué cambia

- La landing muestra «Ver demo sin registro» junto al botón de prueba y un segundo acceso debajo del ejemplo de cotización/reservación.
- Abre una demo precargada, en español o inglés según el idioma actual. Permite editar una cotización, revisar su documento y convertirla en reserva. También permite crear una reserva directa.
- Usa la misma función de cálculo de cotizaciones para total, descuento, propina, anticipo y saldo. La moneda del ejemplo puede cambiarse entre GTQ, MXN y USD sin cambiar las preferencias guardadas del usuario.
- Al finalizar, «Crear mi cuenta gratis» abre el formulario de registro existente para la prueba de Advanced de 10 días. La cuenta nueva empieza vacía.
- En celulares, el primer paso tiene un botón inferior visible para continuar directamente con los datos precargados.

## País, idioma y moneda — actualización del 27 de septiembre

- «Ver demo sin registro» se destaca con fondo naranja suave, borde y texto oscuro legible en ambos temas.
- Área incluye Terraza, Salón principal, Mesa 1 y Mesa 2; en inglés, Terrace, Main dining room, Table 1 y Table 2. El área elegida permanece en el documento y en la reserva de ejemplo.
- La demo y el registro toman la ubicación detectada por Vercel: Guatemala → español y GTQ (Q), México → español y MXN (pesos), Estados Unidos → inglés y USD.
- Los demás países hispanohablantes usan español; el resto usa inglés. Fuera de Guatemala/México, la moneda inicial disponible es USD. Un idioma elegido expresamente por el visitante tiene prioridad sobre la detección automática.
- La demo espera la detección antes de crear sus importes de ejemplo. Si la detección falla o demora más de cinco segundos, usa inglés (salvo preferencia manual) y USD. En el registro, el país queda por seleccionar si no pudo detectarse.
- El registro también precarga el país y el prefijo telefónico. Cambiar el país actualiza idioma y moneda; después se pueden ajustar manualmente. Se envía el nombre del país al registro, como antes.
- Cambiar la moneda en la demo solo cambia sus importes ficticios: no guarda preferencias, no convierte divisas ni cambia los precios de las suscripciones. El registro conserva los dos campos de contraseña.

## Datos y funcionamiento

La demo usa únicamente estado temporal de React. No llama a Supabase, no crea cuentas, no guarda reservas/cotizaciones/clientes, no envía correos y no cobra. Al cerrar o reiniciar, sus datos se descartan. No está dentro del panel de una cuenta: se carga al abrirla desde la landing pública.

No se cambian los SQL, los cálculos de negocio, los componentes de seguridad, los cobros ni las pantallas operativas de la aplicación. La API pública `/api/locale` añade país y moneda a su respuesta de idioma; no se almacena en caché. En el formulario de registro solo se ajustan los valores regionales iniciales y su selección. La API de registro, validaciones de contraseña, captcha, confirmación de correo y analíticas de conversión se conservan. Las preferencias de restaurantes existentes no se modifican por la ubicación del visitante.

## Medición

Se envían los siguientes eventos a Vercel Analytics si la medición ya está habilitada en producción:

| Evento | Acción |
| --- | --- |
| Demo_abierta | Abrir la demo |
| Demo_cotizacion_vista | Ver la cotización de ejemplo |
| Demo_reserva_creada | Llegar a la reserva de ejemplo |
| Demo_registro_click | Pulsar el botón final para crear cuenta |

La única propiedad es `flow`: `quote` o `direct`. No se transmiten nombres, importes ni valores escritos en el formulario. Estos eventos miden acciones de la demo; no equivalen a clientes ni a registros reales. Abrir o completar la demo no envía conversiones de registro/compra a Meta o Google Ads. El registro real conserva sus eventos existentes.

## Publicación

Desplegar el código en el mismo proyecto Vercel, conservando las variables actuales. Esta actualización no requiere nuevas variables ni ejecutar SQL. El ZIP no publica cambios por sí solo.

Después del despliegue: abrir la landing sin sesión, pulsar «Ver demo sin registro», recorrer una cotización y una reserva directa, y comprobar que el botón final abre el registro. Los eventos aparecerán en Vercel Analytics al recibir actividad de producción y dependerán de que el navegador permita la medición.

## Verificación local

- Compilación de producción y TypeScript.
- Pruebas automatizadas de analítica, registro, dominios de pago y transiciones de sesión.
- Recorridos en navegador de cotización a reserva, reserva directa, cierre/reapertura y paso al registro, en computadora y celular.
- Comprobación de que la demo no hace peticiones de escritura ni modifica la moneda guardada.

Las pruebas no crean usuarios ni efectúan cobros en producción.
