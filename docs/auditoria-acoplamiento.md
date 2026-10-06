# Auditoría de acoplamiento — hacia un monolito modular

Método: se leyeron los 349 archivos de `src/` (TS/TSX), se asignó cada uno a un módulo candidato por ruta y nombre, y se contaron las importaciones entre módulos y las tablas que toca cada archivo. La clasificación es **aproximada** (153 archivos de rutas y UI quedaron en «Sitio» o «Panel»); las cifras sirven para ver tendencias, no como medida exacta.

## Resultado en cifras
- 1.068 importaciones internas; 680 (64 %) cruzan entre áreas. Gran parte va a infraestructura compartida (db, utils, i18n), que es normal; el problema son las demás.
- `db/schema.ts` lo importan 103 archivos y `db/index.ts` 77: **79 archivos consultan la base directamente**. Ningún módulo es dueño de sus tablas.
- `siteSettings` la tocan 10 de 12 áreas; `articles`, 8; `authors` y `categories`, 5-6.
- Archivos que concentran lógica de varios módulos: `ai-core.ts` (1.291 líneas), `telegram-bot.ts` (1.241), `article-wizard.tsx` (1.884), `home-builder.tsx` (1.104), `article-editor.tsx` (1.067).

## Dependencias en ambos sentidos (los ciclos a romper)
| Par | A→B | B→A |
|---|---|---|
| Contenido ↔ Portada y tema | 13 | 13 |
| Panel ↔ Portada y tema | 16 | 19 |
| Sitio ↔ Portada y tema | 11 | 32 |
| Contenido ↔ IA | 5 | 7 |
| Contenido ↔ Sitio | 10 | 30 |
| Acceso ↔ Panel | 6 | 30 |

## Lo que ya está bien
Un solo despliegue y una sola base; API `/api/v1` como contrato; Inngest y cron para trabajo asíncrono; `archive-client.ts` como única puerta al archivo histórico; sanidad de entrada centralizada (`sanitize`, `safe-fetch`, `rate-limit`).

## Plan por fases
1. **Fase 0 (medir y frenar):** añadir `eslint-plugin-boundaries` en modo aviso y un chequeo de ciclos (madge/dpdm) en CI. Sin mover archivos.
2. **Fase 1 (IA):** partir `ai-core.ts` en `ia/borrador`, `ia/opciones`, `ia/citas-y-cifras`, `ia/imagenes`, `ia/transcripcion`, y `telegram-bot.ts` en canal + casos de uso. Exponer solo `ia/index.ts`.
3. **Fase 2 (datos):** repositorios por módulo (`contenido/repo.ts`, `newsletter/repo.ts`…). Las rutas y acciones dejan de importar `db` directo; el lint lo prohíbe. `siteSettings` se reparte en configuraciones tipadas por módulo (`tema`, `identidad`, `popup`, `anuncios`).
4. **Fase 3 (eventos):** `contenido` emite `nota.publicada` / `nota.retirada` por Inngest; newsletter, push, sitemap, caché y Telegram reaccionan. Hoy publicar llama a todo directamente.
5. **Fase 4 (portada y tema):** separar el editor (panel) del renderizado público; ambos consumen un contrato de «diseño de portada» sin importarse entre sí.
6. **Fase 5 (cierre):** lint de límites en modo error; cada módulo documenta su interfaz pública. Quedan listos para extraerse a servicio si algún día hace falta.

## Orden sugerido por riesgo/beneficio
IA → datos de contenido → eventos de publicación → portada y tema. Acceso e infraestructura no se tocan: ya son dependencias legítimas de todos.
