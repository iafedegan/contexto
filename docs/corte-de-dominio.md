# Corte de dominio a www.contextoganadero.com

Hoy el portal nuevo responde en `contexto-olive.vercel.app` (proyecto `contexto` del equipo `fedegan1` en Vercel, con ese único dominio asignado) y `www.contextoganadero.com` lo sigue sirviendo el sitio anterior (detrás de Cloudflare). Este documento es la lista de pasos para cambiar el segundo por el primero. Lo ejecuta quien administra el DNS de `contextoganadero.com`.

## Antes (24 a 48 horas)
1. Confirmar quién tiene acceso a la zona DNS (Cloudflare) y a Vercel.
2. **Bajar el TTL** del registro `www` a 300 segundos, para que el cambio y una eventual vuelta atrás sean rápidos.
3. Dejar **el despliegue de la rama principal en verde** y probado en `contexto-olive.vercel.app` (entrar al panel, abrir una nota, el buscador, el asistente).
4. Avisar a la redacción: durante el cambio puede haber minutos con uno u otro sitio.

## El día del corte
1. En Vercel, proyecto `contexto` → *Settings → Domains*: añadir `www.contextoganadero.com` (y, si se quiere, el dominio sin `www` con redirección a `www`). Vercel muestra el registro exacto que hay que crear.
2. En *Settings → Environment Variables*, poner `NEXT_PUBLIC_SITE_URL=https://www.contextoganadero.com` y **volver a desplegar** (las variables `NEXT_PUBLIC_*` se fijan al compilar: canónicas, mapas del sitio, Open Graph y enlaces firmados dependen de ella).
3. Añadir en `PASSKEY_ALLOWED_HOSTS` el valor `contexto-olive.vercel.app` para no perder de golpe las passkeys creadas allí. **Las passkeys están atadas al dominio**: las registradas en `contexto-olive.vercel.app` solo funcionan en ese dominio; en `www` cada persona debe registrar la suya de nuevo (la contraseña con 2FA funciona igual en ambos).
4. En Cloudflare, cambiar el registro `www` al que indicó Vercel. Empezar con el proxy de Cloudflare **desactivado** («solo DNS»), para que Vercel emita el certificado; se puede activar después.
5. Esperar a que Vercel marque el dominio como válido y comprobar `https://www.contextoganadero.com`.

## Después (mismo día)
- Probar: portada, una nota, una dirección antigua de tipo `/seccion/titulo` (debe redirigir con 301), el buscador, el asistente, el panel con 2FA, el boletín (confirmación y baja) y que el cintillo y las imágenes cargan.
- **Search Console:** añadir la propiedad `www.contextoganadero.com` si no existe, enviar `sitemap.xml` y el mapa de noticias, y solicitar la inclusión en Google News (acción de FEDEGÁN).
- **GA4 y GTM:** confirmar que el flujo de datos acepta el dominio nuevo y que llegan visitas.
- **Correo del boletín:** el dominio remitente (SPF, DKIM, DMARC) debe estar verificado en el proveedor (Resend o Gmail).
- Subir de nuevo el TTL a 3600 o más.

## Vuelta atrás
Restaurar el registro `www` anterior en Cloudflare (con TTL de 300 s tarda minutos). No se pierde nada: el portal nuevo sigue en `contexto-olive.vercel.app` y el sitio anterior no se ha tocado.
