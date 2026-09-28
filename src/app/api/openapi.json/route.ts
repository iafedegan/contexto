import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/api/openapi";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** GET /api/openapi.json — la especificación que consume /api-docs (Scalar). */
export async function GET() {
  const spec = await buildOpenApiSpec(siteUrl("").replace(/\/$/, ""));
  return NextResponse.json(spec, { headers: { "cache-control": "public, max-age=300" } });
}
