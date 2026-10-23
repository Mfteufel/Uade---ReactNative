-- 004_publications.sql — Publicaciones de objetos perdidos/encontrados y sus fotos.
-- Idempotente: IF NOT EXISTS, constraints dentro de DO, triggers con DROP IF EXISTS.
-- Reversión: migrations/rollback/004_publications.down.sql (no la aplica migrate.js).
-- Requiere 002 (categories, neighborhoods, set_updated_at) y 003 (photos.kind).
--
-- Ids: publications.id = 'p_' + 24 hex, lo genera el backend. client_id lo genera la app
-- (idempotencia offline): INSERT ... ON CONFLICT (user_id, client_id) DO NOTHING + SELECT.
-- Estados (CHECK, no ENUM): open | in_claim | resolved | expired.
-- Máximo 5 fotos por publicación: position 0..4 + UNIQUE (publication_id, position).
--
-- Reglas que quedan a cargo de la API (no se pueden expresar en la misma fila):
--  * Vencimiento: expires_at = now() + 30 días; al renovar se actualiza expires_at y renewed_at.
--    El estado pasa a 'expired' con UPDATE ... WHERE status IN ('open','in_claim') AND expires_at < now()
--    (antes de leer, o con un script cron); las consultas igual filtran por expires_at.
--  * Cada vez que cambia status, la API actualiza status_changed_at (sirve para las novedades de "seguidas").
--  * verification_answer y exact_address son privadas: solo las ve quien publicó
--    (exact_address también con un reclamo 'accepted'); la API nunca las devuelve a terceros.
--  * Las fotos de la publicación deben tener photos.kind = 'publication' y ser del mismo usuario;
--    al borrar una publicación la API borra sus filas de photos en la misma transacción.
--  * El type de la publicación es inmutable en la práctica: la FK compuesta de claims (005) lo impide.

BEGIN;

-- ---------------------------------------------------------------------------
-- publications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publications (
  id                    text PRIMARY KEY,                       -- 'p_' + 24 hex
  user_id               text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_id             uuid NOT NULL,                          -- generado por la app (modo sin conexión)
  type                  text NOT NULL,                          -- lost | found
  title                 text NOT NULL,
  description           text,
  category_id           text NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  occurred_on           date NOT NULL,                          -- día del suceso
  time_from             time,
  time_to               time,
  neighborhood_id       text NOT NULL REFERENCES neighborhoods (id) ON DELETE RESTRICT,
  exact_address         text,                                   -- sensible
  latitude              numeric(9,6),
  longitude             numeric(9,6),
  verification_question text,                                   -- solo 'found'
  verification_answer   text,                                   -- solo 'found', privada
  status                text NOT NULL DEFAULT 'open',
  status_changed_at     timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  renewed_at            timestamptz,
  search_tsv            tsvector GENERATED ALWAYS AS (
                          to_tsvector('spanish'::regconfig, title || ' ' || coalesce(description, ''))
                        ) STORED,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publications_type_valid CHECK (type IN ('lost', 'found')),
  CONSTRAINT publications_status_valid CHECK (status IN ('open', 'in_claim', 'resolved', 'expired')),
  CONSTRAINT publications_title_not_empty CHECK (btrim(title) <> ''),
  CONSTRAINT publications_time_range_valid CHECK (time_from IS NULL OR time_to IS NULL OR time_from <= time_to),
  CONSTRAINT publications_lat_valid CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT publications_lng_valid CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT publications_coords_together CHECK ((latitude IS NULL) = (longitude IS NULL)),
  -- found <=> pregunta y respuesta de verificación presentes (y no vacías); lost => ninguna.
  CONSTRAINT publications_verification_matches_type CHECK (
    (type = 'found'
       AND verification_question IS NOT NULL AND btrim(verification_question) <> ''
       AND verification_answer   IS NOT NULL AND btrim(verification_answer)   <> '')
    OR
    (type = 'lost' AND verification_question IS NULL AND verification_answer IS NULL)
  )
);

-- Para la FK compuesta de claims (005): el publicador es de verdad el dueño y el tipo coincide.
-- client_id: idempotencia del envío offline, por usuario.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publications_id_user_type_key') THEN
    ALTER TABLE publications
      ADD CONSTRAINT publications_id_user_type_key UNIQUE (id, user_id, type);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publications_user_client_key') THEN
    ALTER TABLE publications
      ADD CONSTRAINT publications_user_client_key UNIQUE (user_id, client_id);
  END IF;
END
$$;

-- Filtros del buscador (solo publicaciones vigentes).
CREATE INDEX IF NOT EXISTS publications_search_filters_idx
  ON publications (type, category_id, neighborhood_id, occurred_on DESC)
  WHERE status IN ('open', 'in_claim');
-- Listados recientes y conteo de novedades de las alertas.
CREATE INDEX IF NOT EXISTS publications_created_at_idx ON publications (created_at DESC);
-- "Mis publicaciones".
CREATE INDEX IF NOT EXISTS publications_user_created_idx ON publications (user_id, created_at DESC);
-- Palabras clave (full-text en español, sin extensiones).
CREATE INDEX IF NOT EXISTS publications_search_tsv_idx ON publications USING gin (search_tsv);
-- Cercanía sin PostGIS: rectángulo con BETWEEN y Haversine en el SELECT.
CREATE INDEX IF NOT EXISTS publications_coords_idx
  ON publications (latitude, longitude) WHERE latitude IS NOT NULL;
-- Vencimientos (UPDATE de expiración).
CREATE INDEX IF NOT EXISTS publications_expires_idx
  ON publications (expires_at) WHERE status IN ('open', 'in_claim');

DROP TRIGGER IF EXISTS publications_set_updated_at ON publications;
CREATE TRIGGER publications_set_updated_at
  BEFORE UPDATE ON publications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- publication_photos: tabla puente a photos, con orden. Máximo 5 por publicación.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publication_photos (
  photo_id       uuid PRIMARY KEY REFERENCES photos (id) ON DELETE CASCADE,
  publication_id text NOT NULL REFERENCES publications (id) ON DELETE CASCADE,
  position       smallint NOT NULL,
  CONSTRAINT publication_photos_position_valid CHECK (position BETWEEN 0 AND 4),
  CONSTRAINT publication_photos_publication_position_key UNIQUE (publication_id, position)
);

COMMIT;
