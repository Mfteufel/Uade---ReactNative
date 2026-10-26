-- 003_users_profile.sql — Perfil de usuario: updated_at, barrio normalizado, tipo de foto e insignias ganadas.
-- Idempotente: ADD COLUMN IF NOT EXISTS, constraints dentro de DO, backfills que no pisan datos.
-- Reversión: migrations/rollback/003_users_profile.down.sql (no la aplica migrate.js).
-- users.neighborhood (texto) se conserva; neighborhood_id es la referencia normalizada (puede ser NULL = sin barrio).
-- Reglas en la API: las insignias se otorgan en la misma transacción que crea la devolución o la valoración.

BEGIN;

-- ---------------------------------------------------------------------------
-- users.updated_at + trigger (usa set_updated_at() de 002)
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- users.neighborhood_id: FK a neighborhoods, ON DELETE RESTRICT. NULL es válido (barrio vacío).
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS neighborhood_id text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_neighborhood_id_fkey') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_neighborhood_id_fkey
      FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods (id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS users_neighborhood_id_idx ON users (neighborhood_id);

-- Backfill por nombre (sin distinguir mayúsculas), solo si hay un único barrio con ese nombre.
UPDATE users u
   SET neighborhood_id = n.id
  FROM neighborhoods n
 WHERE u.neighborhood_id IS NULL
   AND btrim(u.neighborhood) <> ''
   AND lower(btrim(u.neighborhood)) = lower(n.name)
   AND (SELECT count(*) FROM neighborhoods n2 WHERE lower(n2.name) = lower(n.name)) = 1;

-- ---------------------------------------------------------------------------
-- photos.kind: qué representa la imagen. Las existentes son fotos de perfil.
-- ---------------------------------------------------------------------------
ALTER TABLE photos ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'profile';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_kind_valid') THEN
    ALTER TABLE photos
      ADD CONSTRAINT photos_kind_valid CHECK (kind IN ('profile', 'publication', 'claim'));
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- user_badges: insignias ganadas y desde cuándo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_badges (
  user_id   text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  badge_id  text NOT NULL REFERENCES badges (id) ON DELETE RESTRICT,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS user_badges_badge_idx ON user_badges (badge_id);

-- Backfill: fecha del N-ésimo evento (N = goal) según la métrica de cada insignia.
INSERT INTO user_badges (user_id, badge_id, earned_at)
SELECT e.user_id, b.id, e.created_at
  FROM badges b
  JOIN (
    SELECT 'completedReturns' AS metric, user_id, created_at,
           row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
      FROM returns
    UNION ALL
    SELECT 'positiveRatings', rated_user_id, created_at,
           row_number() OVER (PARTITION BY rated_user_id ORDER BY created_at, id)
      FROM ratings
     WHERE positive
  ) e ON e.metric = b.metric AND e.rn = b.goal
ON CONFLICT (user_id, badge_id) DO NOTHING;

COMMIT;
