import test from "node:test";
import assert from "node:assert/strict";
import { RSS_HEADERS } from "@/lib/rss";

// El constructor del feed consulta la base de datos; aquí solo se comprueba lo que no la necesita.
test("el feed se sirve como RSS con caché de CDN", () => {
  assert.match(RSS_HEADERS["Content-Type"], /application\/rss\+xml/);
  assert.match(RSS_HEADERS["Cache-Control"], /s-maxage=/);
});
