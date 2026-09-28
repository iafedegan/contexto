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
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: `API de ${identity.name}`,
      version: "1.0.0",
      description:
        "API pública de solo lectura para artículos y categorías, y de alta al boletín. Todas las peticiones requieren una clave de API.",
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

function errorResponse(desc: string) {
  return { description: desc, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
}
