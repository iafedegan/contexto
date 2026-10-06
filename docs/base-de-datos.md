# Base de datos

Generado desde `src/db/schema.ts` con `npm run docs:bd`. PostgreSQL (Supabase) + `pgvector`; en local, PGlite. Migraciones: `npm run db:generate` → revisar el SQL → `npm run db:migrate`; índices vectoriales y de texto completo en `drizzle/manual/99_post_indexes.sql`.

## `users`

Módulo dueño: **acceso** · variable en el esquema: `users`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `email` | text | obligatorio, único |
| `name` | text | obligatorio |
| `password_hash` | text |  |
| `role` | userRole | obligatorio |
| `totp_secret` | text |  |
| `totp_enabled` | boolean | obligatorio |
| `active` | boolean | obligatorio |
| `created_at` | timestamp | obligatorio |
| `updated_at` | timestamp | obligatorio |

## `passkeys`

Módulo dueño: **acceso** · variable en el esquema: `passkeys`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid |  |
| `credential_id` | text | obligatorio, único |
| `public_key` | text | obligatorio |
| `counter` | integer | obligatorio |
| `device_type` | text | obligatorio |
| `backed_up` | boolean | obligatorio |
| `transports` | text |  |
| `label` | text |  |
| `created_at` | timestamp | obligatorio |
| `last_used_at` | timestamp |  |

## `sessions`

Módulo dueño: **acceso** · variable en el esquema: `sessions`

| Columna | Tipo | Notas |
|---|---|---|
| `session_token` | text | PK |
| `user_id` | uuid |  |
| `expires` | timestamp | obligatorio |

## `verification_tokens`

Módulo dueño: **acceso** · variable en el esquema: `verificationTokens`

| Columna | Tipo | Notas |
|---|---|---|
| `identifier` | text | obligatorio |
| `token` | text | obligatorio |
| `expires` | timestamp | obligatorio |

## `authors`

Módulo dueño: **contenido** · variable en el esquema: `authors`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | obligatorio, único |
| `name` | text | obligatorio |
| `bio` | text |  |
| `avatar_url` | text |  |
| `user_id` | uuid | → users.id |
| `created_at` | timestamp | obligatorio |

## `categories`

Módulo dueño: **contenido** · variable en el esquema: `categories`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | obligatorio, único |
| `name` | text | obligatorio |
| `description` | text |  |
| `parent_id` | uuid |  |
| `legacy_paths` | jsonb | obligatorio |
| `sort_order` | integer | obligatorio |

## `articles`

Módulo dueño: **contenido** · variable en el esquema: `articles`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | obligatorio, único |
| `title` | text | obligatorio |
| `excerpt` | text | obligatorio |
| `body` | text | obligatorio |
| `cover_image_url` | text |  |
| `cover_image_alt` | text |  |
| `category_id` | uuid | → categories.id |
| `author_id` | uuid | → authors.id |
| `status` | editorialStatus | obligatorio |
| `meta_title` | text |  |
| `meta_description` | text |  |
| `tags` | jsonb | obligatorio |
| `published_at` | timestamp |  |
| `scheduled_for` | timestamp |  |
| `updated_at` | timestamp | obligatorio |
| `created_at` | timestamp | obligatorio |
| `created_by` | uuid | → users.id |
| `origin_draft_id` | uuid |  |
| `embedding` | vector |  |
| `home_position` | integer |  |
| `home_style` | jsonb |  |
| `is_breaking` | boolean | obligatorio |
| `is_live` | boolean | obligatorio |
| `views` | integer | obligatorio |

## `article_views_daily`

Módulo dueño: **analitica** · variable en el esquema: `articleViewsDaily`

| Columna | Tipo | Notas |
|---|---|---|
| `article_id` | uuid |  |
| `day` | date | obligatorio |
| `views` | integer | obligatorio |

## `rate_limits`

Módulo dueño: **infra** · variable en el esquema: `rateLimits`

| Columna | Tipo | Notas |
|---|---|---|
| `key` | text | PK |
| `count` | integer | obligatorio |
| `reset_at` | timestamp | obligatorio |

## `archive_index`

Módulo dueño: **archivo** · variable en el esquema: `archiveIndex`

| Columna | Tipo | Notas |
|---|---|---|
| `external_id` | text | PK |
| `canonical_url` | text | obligatorio |
| `title` | text | obligatorio |
| `summary` | text | obligatorio |
| `legacy_category` | text |  |
| `published_at` | timestamp |  |
| `source_hash` | text | obligatorio |
| `synced_at` | timestamp | obligatorio |
| `embedding` | vector |  |

## `ads_zones`

Módulo dueño: **portada-tema** · variable en el esquema: `adsZones`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `key` | text | obligatorio, único |
| `name` | text | obligatorio |
| `html` | text |  |
| `image_url` | text |  |
| `click_url` | text |  |
| `active` | boolean | obligatorio |
| `starts_at` | timestamp |  |
| `ends_at` | timestamp |  |

## `newsletter_subscribers`

Módulo dueño: **newsletter** · variable en el esquema: `newsletterSubscribers`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `email` | text | obligatorio, único |
| `first_name` | text |  |
| `last_name` | text |  |
| `birth_date` | date |  |
| `mobile` | text |  |
| `signup_ip` | text |  |
| `signup_city` | text |  |
| `signup_postal` | text |  |
| `neighborhood` | text |  |
| `signup_geo_source` | text |  |
| `signup_geo_accuracy` | numeric |  |
| `signup_country` | text |  |
| `signup_lat` | numeric |  |
| `signup_lon` | numeric |  |
| `confirmed` | boolean | obligatorio |
| `confirm_token` | text |  |
| `unsubscribed_at` | timestamp |  |
| `created_at` | timestamp | obligatorio |

## `data_series`

Módulo dueño: **analitica** · variable en el esquema: `dataSeries`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `key` | text | obligatorio, único |
| `name` | text | obligatorio |
| `unit` | text | obligatorio |
| `source` | text | obligatorio |

## `data_points`

Módulo dueño: **analitica** · variable en el esquema: `dataPoints`

| Columna | Tipo | Notas |
|---|---|---|
| `series_id` | uuid |  |
| `observed_on` | date | obligatorio |
| `value` | numeric | obligatorio |

## `agent_drafts`

Módulo dueño: **ia** · variable en el esquema: `agentDrafts`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `source` | agentSource | obligatorio |
| `source_ref` | text | obligatorio |
| `source_payload` | jsonb |  |
| `model_version` | text | obligatorio |
| `title` | text | obligatorio |
| `excerpt` | text | obligatorio |
| `body` | text | obligatorio |
| `suggested_category_id` | uuid | → categories.id |

## `assistant_queries`

Módulo dueño: **ia** · variable en el esquema: `assistantQueries`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | text | obligatorio |
| `question` | text | obligatorio |
| `mode` | assistantMode | obligatorio |
| `cited_sources` | jsonb |  |
| `answered` | boolean | obligatorio |
| `input_tokens` | integer | obligatorio |
| `output_tokens` | integer | obligatorio |
| `cost_usd` | numeric | obligatorio |
| `created_at` | timestamp | obligatorio |

## `redirects`

Módulo dueño: **contenido** · variable en el esquema: `redirects`

| Columna | Tipo | Notas |
|---|---|---|
| `from_path` | text | PK |
| `to_path` | text | obligatorio |
| `status_code` | integer | obligatorio |
| `hits` | integer | obligatorio |
| `created_at` | timestamp | obligatorio |

## `newsletter_editions`

Módulo dueño: **newsletter** · variable en el esquema: `newsletterEditions`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `subject` | text | obligatorio |
| `preheader` | text | obligatorio |
| `intro` | text | obligatorio |
| `article_slugs` | jsonb | obligatorio |
| `status` | text | obligatorio |
| `issue` | integer |  |
| `cursor` | text |  |
| `total` | integer | obligatorio |
| `delivered` | integer | obligatorio |
| `failed` | integer | obligatorio |
| `started_at` | timestamp |  |
| `sent_at` | timestamp |  |
| `created_by` | uuid | → users.id |
| `created_at` | timestamp | obligatorio |
| `updated_at` | timestamp | obligatorio |

## `api_clients`

Módulo dueño: **acceso** · variable en el esquema: `apiClients`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | obligatorio |
| `key_hash` | text | obligatorio, único |
| `key_prefix` | text | obligatorio |
| `active` | boolean | obligatorio |
| `requests_per_hour` | integer | obligatorio |
| `last_used_at` | timestamp |  |
| `created_by` | uuid | → users.id |
| `created_at` | timestamp | obligatorio |

## `site_settings`

Módulo dueño: **portada-tema / configuración** · variable en el esquema: `siteSettings`

| Columna | Tipo | Notas |
|---|---|---|
| `key` | text | PK |
| `value` | jsonb | obligatorio |
| `updated_at` | timestamp | obligatorio |

## `contact_messages`

Módulo dueño: **contenido (contacto)** · variable en el esquema: `contactMessages`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `kind` | contactKind | obligatorio |
| `name` | text | obligatorio |
| `email` | text | obligatorio |
| `organization` | text |  |
| `subject` | text |  |
| `message` | text | obligatorio |
| `handled` | boolean | obligatorio |
| `created_at` | timestamp | obligatorio |

## `push_subscriptions`

Módulo dueño: **canales** · variable en el esquema: `pushSubscriptions`

| Columna | Tipo | Notas |
|---|---|---|
| `endpoint` | text | PK |
| `p256dh` | text | obligatorio |
| `auth` | text | obligatorio |
| `created_at` | timestamp | obligatorio |
| `last_seen_at` | timestamp | obligatorio |
