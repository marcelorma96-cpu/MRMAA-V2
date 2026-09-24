# Píxel de Meta en MRMAA

Píxel: **1105508185670938**.

## Qué incorpora esta actualización

- Carga asíncrona del píxel únicamente en la landing pública de `https://mrmaa.com/` o `https://www.mrmaa.com/`, después de comprobar que no hay sesión iniciada.
- Un evento `PageView` por carga del documento. Volver desde Iniciar sesión o Registrarse a la landing no duplica la visita.
- Admite los parámetros habituales de campaña `utm_*` indicados en el código y `fbclid`. Omite direcciones con parámetros de acceso, recuperación, invitaciones, soporte o datos desconocidos.
- Al abandonar la landing, suspende el envío del píxel. No se monta en formularios de acceso/registro, paneles privados ni páginas legales.
- Configuración automática del píxel desactivada, sin enviar nombres, correos, teléfonos ni datos operativos como parámetros de eventos. Meta recibe datos técnicos propios de una visita web, incluidos dirección de la página e identificadores de navegador/publicidad.
- Un bloqueo o fallo del script publicitario no impide utilizar MRMAA.
- No se carga en localhost ni dominios de vista previa de Vercel.

Esta entrega incorpora el código base para medir visitas. **No implementa eventos `CompleteRegistration`, `StartTrial` ni `Purchase`**. Una visita no representa una venta. La medición de conversiones necesita una integración posterior con los resultados reales del registro y los pagos.

## Actualizar la aplicación

1. Actualice el código en el mismo repositorio/proyecto de Vercel que sirve MRMAA, conservando todas sus variables de entorno actuales.
2. Despliegue el proyecto como de costumbre. No necesita nuevas claves ni cambiar la conexión de Supabase.
3. **No ejecute SQL para instalar el píxel.** Los SQL anteriores incluidos en el ZIP se conservan sin cambios; esta actualización no requiere volver a ejecutarlos.
4. No añada otra copia del píxel mediante otra herramienta: esta versión ya incorpora el identificador.

Para desactivar solo esta medición, defina `NEXT_PUBLIC_META_PIXEL_ENABLED=false` en Vercel y vuelva a desplegar. Sin esa variable, la medición está habilitada en los dos dominios indicados.

## Verificar antes de activar la pauta

1. En el Administrador de eventos de Meta, seleccione el píxel `1105508185670938` y abra **Probar eventos**.
2. Visite `https://mrmaa.com/` en un navegador sin sesión de MRMAA y sin bloqueador de publicidad. Compruebe que aparece `PageView`.
3. Entre y vuelva desde el formulario de acceso: no debe aparecer otra visita por ese simple cambio de vista.
4. Compruebe que abrir MRMAA con una sesión existente no genera un `PageView` de esta integración.
5. Revise en Meta que no estén habilitadas reglas adicionales creadas con su herramienta de configuración de eventos ni coincidencias avanzadas automáticas. Esta integración envía expresamente solo `PageView`.

No se han realizado conexiones a la base de datos de producción ni modificaciones de datos. Se conservan las reservaciones, clientes, horarios, cotizaciones, configuraciones y código de pagos del ZIP de origen. Mantener la misma configuración de Supabase al desplegar es necesario para seguir accediendo a la misma información.

## Comprobaciones de esta entrega

- `node --test tests/meta-pixel.test.cjs`: 10 pruebas aprobadas, incluidos carga tardía, salida de la landing, bloqueador, errores del script, duplicados y exclusión de enlaces privados.
- `npx tsc --noEmit --incremental false`: aprobado.
- `npm run build`: aprobado.
- Comparación con los 113 archivos del ZIP de origen: únicamente cambian `app/page.tsx` (importación y efecto dentro de Landing) y `next.config.mjs` (dominios del píxel en la política de seguridad). Los restantes 111 archivos son idénticos byte por byte.
- Se añaden `lib/meta-pixel.ts`, `tests/meta-pixel.test.cjs` y este instructivo. No cambian paquetes ni versiones de dependencias.
- Las pruebas usan un entorno simulado para Meta; la recepción real de `PageView` queda pendiente de verificar tras el despliegue. No se ha publicado el sitio ni activado el anuncio desde esta entrega.
