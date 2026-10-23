-- 006_meeting_points.sql — Puntos de encuentro propuestos sobre un reclamo aceptado (con historial).
-- Idempotente: IF NOT EXISTS, constraints dentro de DO, triggers con DROP IF EXISTS.
-- Reversión: migrations/rollback/006_meeting_points.down.sql (no la aplica migrate.js).
-- Requiere 001 (users), 002 (set_updated_at) y 005 (claims).
--
-- Ids: meeting_points.id = 'm_' + 24 hex, lo genera el backend.
-- Estados (CHECK, no ENUM): proposed | accepted | counter_proposed.
--   proposed         = propuesto, a la espera de respuesta de la otra parte.
--   accepted         = la otra parte lo aceptó.
--   counter_proposed = la otra parte respondió con otro punto; el nuevo apunta a este con replaces_id.
-- Historial: cada propuesta es una fila. Una contrapropuesta es una fila nueva con replaces_id = punto anterior.
-- Vigente = 'proposed' o 'accepted'. Un solo vigente por reclamo (índice único parcial).
-- La marca de cuándo se concretó la devolución NO va acá: es returns.created_at (paso 7 del plan, migración 007).
--
-- Reglas que quedan a cargo de la API (cruzan tablas):
--  * Solo se propone un punto si el reclamo está 'accepted'.
--  * proposed_by debe ser el publicador o el reclamante del reclamo.
--  * Responder: la API pasa el vigente a 'accepted' o 'counter_proposed' (completando responded_at)
--    y, en el segundo caso, inserta el nuevo 'proposed' con replaces_id, todo en la misma transacción.
--  * Responde la parte que NO propuso.

BEGIN;

CREATE TABLE IF NOT EXISTS meeting_points (
  id           text PRIMARY KEY,                                          -- 'm_' + 24 hex
  claim_id     text NOT NULL REFERENCES claims (id) ON DELETE CASCADE,
  proposed_by  text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  replaces_id  text REFERENCES meeting_points (id) ON DELETE SET NULL,
  address      text NOT NULL,
  latitude     numeric(9,6),
  longitude    numeric(9,6),
  meet_at      timestamptz,
  notes        text,
  status       text NOT NULL DEFAULT 'proposed',
  responded_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_points_status_valid CHECK (status IN ('proposed', 'accepted', 'counter_proposed')),
  CONSTRAINT meeting_points_address_not_blank CHECK (btrim(address) <> ''),
  CONSTRAINT meeting_points_lat_valid CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT meeting_points_lng_valid CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT meeting_points_coords_together CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CONSTRAINT meeting_points_responded_matches_status CHECK ((status = 'proposed') = (responded_at IS NULL)),
  CONSTRAINT meeting_points_not_self_replace CHECK (replaces_id IS NULL OR replaces_id <> id)
);

-- Un solo punto vigente (proposed/accepted) por reclamo.
CREATE UNIQUE INDEX IF NOT EXISTS meeting_points_one_current_per_claim_idx
  ON meeting_points (claim_id) WHERE status IN ('proposed', 'accepted');
-- Historial de un reclamo.
CREATE INDEX IF NOT EXISTS meeting_points_claim_created_idx ON meeting_points (claim_id, created_at DESC);
-- Propuestas de una persona.
CREATE INDEX IF NOT EXISTS meeting_points_proposed_by_idx ON meeting_points (proposed_by);

DROP TRIGGER IF EXISTS meeting_points_set_updated_at ON meeting_points;
CREATE TRIGGER meeting_points_set_updated_at
  BEFORE UPDATE ON meeting_points
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
