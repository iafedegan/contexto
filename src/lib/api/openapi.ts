import "server-only";
import { getSiteIdentity } from "@/lib/site-identity";

/**
 * Especificación OpenAPI 3.1 de `/api/v1/*`, escrita a mano (la API es
 * pequeña y estable; generarla desde las rutas añadiría una dependencia sin
 * necesidad real). La sirve `/api/openapi.json` y la renderiza `/api-docs`.
 */
export async function buildOpenApiSpec(origin: string) {
  const identity = await getSiteIdentity();
  const articulo = {
    type: "object",
    properties: {
      slug: { type: "string" },
      title: { type: "string" },
      excerpt: { type: "string" },
      coverImageUrl: { type: "string", nullable: true },
      categoria: { type: "string", nullable: true },
      autor: { type: "string", nullable: true },
      publicadoEn: { type: "string", format: "date-time", nullable: true },
      actualizadoEn: { type: "string", format: "date-time" },
      ubicacion: { $ref: "#/components/schemas/Ubicacion" },
    },
  };

  // Dónde está la nota ahora mismo (ver src/lib/ubicacion-nota.ts).
  const ubicacion = {
    type: "object",
    description: "Dónde está la nota ahora mismo: portada, sección, última hora, en vivo y más leídas.",
    properties: {
      portada: {
        type: "object",
        properties: {
          esta: { type: "boolean", description: "La nota sale hoy en la portada." },
          zona: {
            type: "string",
            nullable: true,
            enum: ["principal", "secundaria", "en_breve", "rio", null],
            description: "Hueco de la portada: principal (1), secundaria (1), en_breve (4) o rio (el resto). `null` si no está en la portada.",
          },
          posicion: { type: "integer", nullable: true, description: "1 = la primera de la portada. `null` si no está." },
          fijadaPorEditor: { type: "boolean", description: "`true` si un editor la fijó en el panel; `false` si entró por ser de las más recientes." },
        },
      },
      seccion: {
        type: "object",
        nullable: true,
        description: "Sección (categoría) de la nota; si es una subsección, `padre` es la sección de la que cuelga.",
        properties: {
          slug: { type: "string" },
          nombre: { type: "string" },
          padre: { type: "object", nullable: true, properties: { slug: { type: "string" }, nombre: { type: "string" } } },
        },
      },
      ultimaHora: {
        type: "object",
        properties: {
          marcada: { type: "boolean", description: "El editor la marcó como «Última hora»." },
          enBarra: { type: "boolean", description: "Es la que muestra hoy la barra roja (solo se muestra la marcada más reciente)." },
        },
      },
      enVivo: { type: "boolean", description: "Lleva la etiqueta «En vivo»." },
      masLeidas: {
        type: "object",
        properties: { esta: { type: "boolean" }, posicion: { type: "integer", nullable: true, description: "1 = la más leída." } },
      },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: `API de ${identity.name}`,
      version: "1.0.0",
      description:
        "API pública de solo lectura para artículos y categorías, y de alta al boletín. Cada artículo trae `ubicacion` (portada, sección, última hora, en vivo, más leídas). Todas las peticiones requieren una clave de API.",
      contact: { url: `${origin}/panel` },
    },
    servers: [{ url: `${origin}/api/v1`, description: "Producción" }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          description: "También se acepta como encabezado `X-API-Key: <clave>`.",
        },
      },
      schemas: {
        Ubicacion: ubicacion,
        Articulo: articulo,
        ArticuloDetalle: {
          type: "object",
          properties: {
            ...articulo.properties,
            body: { type: "string", description: "HTML saneado del cuerpo de la nota." },
            coverImageAlt: { type: "string", nullable: true },
            etiquetas: { type: "array", items: { type: "string" } },
          },
        },
        Categoria: {
          type: "object",
          properties: {
            slug: { type: "string" },
            nombre: { type: "string" },
            descripcion: { type: "string", nullable: true },
            categoriaPadre: { type: "string", nullable: true },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" }, message: { type: "string" } },
        },
      },
    },
    paths: {
      "/articulos": {
        get: {
          summary: "Listar artículos publicados",
          parameters: [
            { name: "limite", in: "query", schema: { type: "integer", default: 20, maximum: 50 } },
            { name: "categoria", in: "query", schema: { type: "string" }, description: "Filtra por slug de categoría." },
            { name: "portada", in: "query", schema: { type: "string", enum: ["1"] }, description: "Con `1`, devuelve solo las notas que están hoy en la portada, en el orden de la portada (ignora `limite` y `cursor`)." },
            { name: "cursor", in: "query", schema: { type: "string", format: "date-time" }, description: "Fecha de publicación del último artículo recibido, para pedir la página siguiente." },
          ],
          responses: {
            "200": {
              description: "Página de artículos",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: { type: "array", items: { $ref: "#/components/schemas/Articulo" } },
                      siguienteCursor: { type: "string", format: "date-time", nullable: true },
                    },
                  },
                },
              },
            },
            "401": errorResponse("Falta o es inválida la clave de API"),
            "429": errorResponse("Límite de peticiones excedido"),
          },
        },
      },
      "/articulos/{slug}": {
        get: {
          summary: "Obtener un artículo por slug",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "El artículo", content: { "application/json": { schema: { $ref: "#/components/schemas/ArticuloDetalle" } } } },
            "404": errorResponse("No existe una nota publicada con ese slug"),
          },
        },
      },
      "/categorias": {
        get: {
          summary: "Listar categorías",
          responses: {
            "200": {
              description: "Todas las categorías",
              content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Categoria" } } } } } },
            },
          },
        },
      },
      "/boletin/suscripcion": {
        post: {
          summary: "Suscribir un correo al boletín",
          description: "Doble confirmación: la persona recibe un correo y no queda activa hasta que lo confirma.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } },
          },
          responses: {
            "201": { description: "Alta registrada, pendiente de confirmar" },
            "400": errorResponse("Correo inválido"),
          },
        },
      },
    },
  };
}

// Respuesta de error estándar de la especificación OpenAPI (esquema Error).
function errorResponse(desc: string) {
  return { description: desc, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
}
