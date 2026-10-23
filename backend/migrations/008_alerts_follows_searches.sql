-- 008_alerts_follows_searches.sql — Alertas (búsquedas guardadas), publicaciones seguidas y últimas búsquedas.
-- Idempotente: IF NOT EXISTS, constraints dentro de DO, triggers con DROP IF EXISTS.
-- Reversión: migrations/rollback/008_alerts_follows_searches.down.sql (no la aplica migrate.js).
-- Requiere 001 (users), 002 (categories, neighborhoods, set_updated_at) y 004 (publications).
--
-- Se calcula en la consulta (no se guarda):
--  * Publicaciones nuevas por alerta: publications.created_at > alerts.last_seen_at con los criterios
--    de la alerta (type, category_id, neighborhood_id, search_tsv @@ keywords), solo vigentes.
--  * Novedad de una seguida: publications.status_changed_at > follows.seen_at.
--  * "Marcar como vista": la API pone last_seen_at / seen_at = now().
-- Reglas a cargo de la API: alerts.id = 'a_' + 24 hex; recent_searches conserva solo las últimas 10 por usuario.

BEGIN;

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id               text PRIMARY KEY,                                          -- 'a_' + 24 hex
  user_id          text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  publication_type text,                                                      -- lost | found | NULL (cualquiera)
  category_id      text REFERENCES categories (id) ON DELETE CASCADE,
  neighborhood_id  text REFERENCES neighborhoods (id) ON DELETE CASCADE,
  keywords         text,
  paused           boolean NOT NULL DEFAULT false,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alerts_type_valid CHECK (publication_type IS NULL OR publication_type IN ('lost', 'found')),
  CONSTRAINT alerts_keywords_not_empty CHECK (keywords IS NULL OR btrim(keywords) <> ''),
  CONSTRAINT alerts_has_criteria CHECK (
    publication_type IS NOT NULL OR category_id IS NOT NULL
    OR neighborhood_id IS NOT NULL OR keywords IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS alerts_user_created_idx ON alerts (user_id, created_at DESC);
-- Alertas activas por usuario (conteo de novedades).
CREATE INDEX IF NOT EXISTS alerts_user_active_idx ON alerts (user_id) WHERE NOT paused;

DROP TRIGGER IF EXISTS alerts_set_updated_at ON alerts;
CREATE TRIGGER alerts_set_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- follows: publicaciones seguidas. seen_at = última vez que el usuario vio la novedad.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  user_id        text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  publication_id text NOT NULL REFERENCES publications (id) ON DELETE CASCADE,
  seen_at        timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, publication_id)
);

CREATE INDEX IF NOT EXISTS follows_publication_idx ON follows (publication_id);

-- ---------------------------------------------------------------------------
-- recent_searches: últimas búsquedas con sus criterios.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recent_searches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type            text,                                                       -- lost | found | NULL
  category_id     text REFERENCES categories (id) ON DELETE SET NULL,
  keywords        text,
  neighborhood_id text REFERENCES neighborhoods (id) ON DELETE SET NULL,
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  radius_m        integer,
  date_from       date,
  date_to         date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recent_searches_type_valid CHECK (type IS NULL OR type IN ('lost', 'found')),
  CONSTRAINT recent_searches_dates_valid CHECK (date_from IS NULL OR date_to IS NULL OR date_from <= date_to),
  CONSTRAINT recent_searches_lat_valid CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT recent_searches_lng_valid CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT recent_searches_radius_valid CHECK (radius_m IS NULL OR radius_m > 0),
  CONSTRAINT recent_searches_geo_together CHECK (
    (latitude IS NULL AND longitude IS NULL AND radius_m IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL AND radius_m IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS recent_searches_user_created_idx ON recent_searches (user_id, created_at DESC);

COMMIT;
