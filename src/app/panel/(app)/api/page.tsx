import { desc } from "drizzle-orm";
import { db } from "@/db";
import { apiClients } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ApiKeysManager } from "./api-keys-manager";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(d) : "Nunca");

export default async function ApiPage() {
  const user = await requireRole("editor");
  const clients = await db
    .select({ id: apiClients.id, name: apiClients.name, keyPrefix: apiClients.keyPrefix, active: apiClients.active, requestsPerHour: apiClients.requestsPerHour, lastUsedAt: apiClients.lastUsedAt, createdAt: apiClients.createdAt })
    .from(apiClients)
    .orderBy(desc(apiClients.createdAt));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="lx-kicker text-[var(--accent)]">Configuración</p>
        <h1 className="lx-display mt-2 text-3xl font-semibold tracking-tight">API pública</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--fg-muted)]">
          Expón artículos, categorías y el alta al boletín a sitios y aplicaciones de terceros. Cada integración usa su propia
          clave, con su propio límite de peticiones por hora, para poder identificarla y revocarla sin afectar a las demás.
        </p>
        <a href="/api-docs" target="_blank" rel="noreferrer" className="lx-link mt-3 inline-block text-sm">
          Ver la documentación interactiva (/api-docs) →
        </a>
      </header>

      <ApiKeysManager
        clients={clients.map((c) => ({ ...c, lastUsedAt: fmt(c.lastUsedAt), createdAt: fmt(c.createdAt) }))}
        canManage={user.role === "administrador"}
      />
    </div>
  );
}
