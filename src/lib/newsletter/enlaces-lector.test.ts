import test from "node:test";
import assert from "node:assert/strict";
import { renderNewsletterHtml, renderNewsletterText, type NewsletterRender } from "@/lib/newsletter/template";

const base = (lector?: { id: string; token: string }): NewsletterRender =>
  ({
    siteName: "CONtexto Ganadero",
    settings: { fromName: "x", fromEmail: "x@x.co", replyTo: "", accentColor: "#1f3f78", headerTagline: "t", legalText: "legal", address: "Bogotá", subjectPrefix: "" },
    subject: "Edición 7",
    preheader: "p",
    intro: "hola",
    articles: [
      { slug: "nota-uno", title: "Nota uno", excerpt: "e", coverImageUrl: null, categoryName: "Ganadería", authorName: "A", publishedAt: new Date("2026-10-01") },
      { slug: "nota-dos", title: "Nota dos", excerpt: "e", coverImageUrl: null, categoryName: null, authorName: null, publishedAt: null },
    ],
    issue: 7,
    unsubscribeUrl: "https://contexto.test/boletin/baja?s=1&t=2",
    ...(lector ? { lector } : {}),
  }) as unknown as NewsletterRender;

const ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

test("los enlaces a notas del correo llevan la firma del suscriptor SOLO si autorizó que se relacione su lectura", () => {
  const con = renderNewsletterHtml(base({ id: ID, token: "firma-de-prueba-0123456789abcdef" }));
  const enlaces = [...con.matchAll(/href="([^"]*\/articulo\/[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  assert.ok(enlaces.length >= 2);
  for (const e of enlaces) {
    const u = new URL(e);
    assert.equal(u.searchParams.get("cgs"), ID);
    assert.equal(u.searchParams.get("cgt"), "firma-de-prueba-0123456789abcdef");
    assert.equal(u.searchParams.get("utm_source"), "boletin", "las campañas siguen midiéndose igual");
  }
  const sin = renderNewsletterHtml(base());
  assert.doesNotMatch(sin, /cgs=|cgt=/, "sin autorización, ningún enlace identifica a nadie");
  assert.match(renderNewsletterText(base({ id: ID, token: "firma-de-prueba-0123456789abcdef" })), /cgs=/);
  assert.doesNotMatch(renderNewsletterText(base()), /cgs=|cgt=/);
});
