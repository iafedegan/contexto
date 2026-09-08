-- Se ejecuta DESPUÉS de `drizzle-kit migrate`.
-- Índices que drizzle-kit no emite de forma estable (HNSW vectorial + GIN FTS).

-- --- Búsqueda vectorial (coseno) --------------------------------------------
CREATE INDEX IF NOT EXISTS articles_embedding_hnsw
  ON articles USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS archive_embedding_hnsw
  ON archive_index USING hnsw (embedding vector_cosine_ops);

-- --- Full-text en español --------------------------------------------------
CREATE INDEX IF NOT EXISTS articles_fts_es
  ON articles USING gin (
    to_tsvector('spanish', title || ' ' || excerpt || ' ' || body)
  );

CREATE INDEX IF NOT EXISTS archive_fts_es
  ON archive_index USING gin (
    to_tsvector('spanish', title || ' ' || summary)
  );

-- Trigram para autocompletar / búsquedas tolerantes a errores de tipeo.
CREATE INDEX IF NOT EXISTS articles_title_trgm
  ON articles USING gin (title gin_trgm_ops);
