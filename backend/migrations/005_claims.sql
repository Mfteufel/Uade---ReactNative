-- 005_claims.sql — Reclamos sobre publicaciones ("es mío" / "lo encontré").
-- Idempotente: IF NOT EXISTS, constraints dentro de DO, triggers con DROP IF EXISTS.
-- Reversión: migrations/rollback/005_claims.down.sql (no la aplica migrate.js).
-- Requiere 002 (neighborhoods, set_updated_at), 003 (photos) y 004 (publications con UNIQUE (id, user_id, type)).
--
-- Ids: claims.id = 'c_' + 24 hex, lo genera el backend.
-- Tipo de reclamo (CHECK, no ENUM): mine | found.
--   mine  = "es mío": solo sobre una publicación 'found'. Lleva la respuesta a la verificación;
--           descripción y foto opcionales.
--   found = "lo encontré": solo sobre una publicación 'lost'. Foto y barrio del hallazgo obligatorios.
--   Esto lo asegura la FK compuesta (publication_id, publisher_id, publication_type) + el CHECK
--   (type = 'mine') = (publication_type = 'found').
-- Estados (CHECK, sin 'cancelled'): pending | accepted | rejected | expired.
-- Intentos: máximo 3 por persona por publicación con attempt_number 1..3 + UNIQUE (sin trigger).
-- Vencimiento: expires_at = created_at + 48 h (default now() + 48 h).
--
-- Reglas que quedan a cargo de la API (no se pueden expresar en la misma fila):
--  * attempt_number = max + 1 dentro de la transacción; si dos pedidos chocan, el UNIQUE hace fallar uno.
--  * Un reclamo 'pending' pasa a 'expired' con UPDATE ... WHERE status = 'pending' AND expires_at < now()
--    (antes de leer, o con un script cron); en ese UPDATE se completa decided_at.
--  * Al aceptar un reclamo la API pone la publicación en 'in_claim'; al rechazar/vencer la reabre.
--  * photo_id debe ser una foto del reclamante con photos.kind = 'claim' (o el que defina la API).
--  * verification_answer se compara contra publications.verification_answer solo en el servidor.
--  * Al borrar un reclamo la API borra su foto en la misma transacción (photo_id es NO ACTION).

BEGIN;

CREATE TABLE IF NOT EXISTS claims (
  id                    text PRIMARY KEY,                                   -- 'c_' + 24 hex
  publication_id        text NOT NULL,
  publisher_id          text NOT NULL,                                      -- dueño de la publicación
  publication_type      text NOT NULL,                                      -- copia de publications.type
  claimer_id            text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type                  text NOT NULL,                                      -- mine | found
  attempt_number        smallint NOT NULL,                                  -- 1..3
  verification_answer   text,                                               -- solo 'mine'
  description           text,
  photo_id              uuid REFERENCES photos (id),                        -- obligatoria si 'found'
  found_neighborhood_id text REFERENCES neighborhoods (id) ON DELETE RESTRICT, -- obligatorio si 'found'
  status                text NOT NULL DEFAULT 'pending',
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  decided_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claims_type_valid CHECK (type IN ('mine', 'found')),
  CONSTRAINT claims_status_valid CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  CONSTRAINT claims_attempt_valid CHECK (attempt_number BETWEEN 1 AND 3),
  CONSTRAINT claims_not_own_publication CHECK (claimer_id <> publisher_id),
  CONSTRAINT claims_type_matches_publication CHECK ((type = 'mine') = (publication_type = 'found')),
  CONSTRAINT claims_mine_has_answer CHECK (
    type <> 'mine' OR (verification_answer IS NOT NULL AND btrim(verification_answer) <> '')
  ),
  CONSTRAINT claims_found_has_photo_and_place CHECK (
    type <> 'found' OR (photo_id IS NOT NULL AND found_neighborhood_id IS NOT NULL)
  ),
  CONSTRAINT claims_decided_matches_status CHECK ((status = 'pending') = (decided_at IS NULL)),
  CONSTRAINT claims_expires_after_created CHECK (expires_at > created_at)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'claims_publication_fkey') THEN
    ALTER TABLE claims
      ADD CONSTRAINT claims_publication_fkey
      FOREIGN KEY (publication_id, publisher_id, publication_type)
      REFERENCES publications (id, user_id, type) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'claims_attempt_key') THEN
    ALTER TABLE claims
      ADD CONSTRAINT claims_attempt_key UNIQUE (publication_id, claimer_id, attempt_number);
  END IF;
END
$$;

-- Un reclamo activo (pending/accepted) por persona y publicación.
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_active_per_claimer_idx
  ON claims (publication_id, claimer_id) WHERE status IN ('pending', 'accepted');
-- Un solo reclamo aceptado por publicación.
CREATE UNIQUE INDEX IF NOT EXISTS claims_one_accepted_per_publication_idx
  ON claims (publication_id) WHERE status = 'accepted';
-- Reclamos enviados / recibidos.
CREATE INDEX IF NOT EXISTS claims_claimer_created_idx ON claims (claimer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS claims_publisher_created_idx ON claims (publisher_id, created_at DESC);
-- Reclamos de una publicación.
CREATE INDEX IF NOT EXISTS claims_publication_status_idx ON claims (publication_id, status);
-- Vencimientos (UPDATE de expiración).
CREATE INDEX IF NOT EXISTS claims_pending_expires_idx
  ON claims (status, expires_at) WHERE status = 'pending';

DROP TRIGGER IF EXISTS claims_set_updated_at ON claims;
CREATE TRIGGER claims_set_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
