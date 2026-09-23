import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/** Sale de Draft Mode (enlace "Salir de vista previa" del banner). */
export async function GET(req: Request) {
  (await draftMode()).disable();
  const { searchParams } = new URL(req.url);
  redirect(searchParams.get("from") || "/");
}
