-- 007_returns_ratings_thanks.sql — Devoluciones atadas a reclamos, valoraciones por devolución y agradecimientos.
-- Idempotente: ADD COLUMN IF NOT EXISTS, constraints dentro de DO, índices IF NOT EXISTS.
-- Reversión: migrations/rollback/007_returns_ratings_thanks.down.sql (no la aplica migrate.js).
-- Requiere 001 (users, returns, ratings), 002 (set_updated_at), 005 (claims) y 006 (meeting_points).
--
-- Las filas existentes de returns y ratings NO se tocan: las columnas nuevas quedan en NULL.
-- (ratings.return_id NULL no choca con UNIQUE (return_id, author_id), porque UNIQUE permite NULL.)
--
-- Reglas que quedan a cargo de la API (cruzan tablas o dependen de la fecha):
--  * Se puede valorar hasta 7 días después de returns.created_at: lo valida la API, no la base.
--  * Valoran solo las dos partes de la devolución (user_id y recovered_by_id) y rated_user_id es la otra parte.
--  * Agradece quien recuperó (thanks.author_id = returns.recovered_by_id) a quien devolvió (recipient_id = returns.user_id).

BEGIN;

-- returns: quién recuperó, de qué reclamo salió y en qué punto de encuentro.
ALTER TABLE returns ADD COLUMN IF NOT EXISTS recovered_by_id   text   REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS claim_id          text   REFERENCES claims (id) ON DELETE SET NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS meeting_point_id  text   REFERENCES meeting_points (id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'returns_claim_id_key') THEN
    ALTER TABLE returns ADD CONSTRAINT returns_claim_id_key UNIQUE (claim_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'returns_not_self_recovered') THEN
    ALTER TABLE returns ADD CONSTRAINT returns_not_self_recovered CHECK (recovered_by_id <> user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS returns_recovered_by_idx ON returns (recovered_by_id);

-- ratings: atadas a una devolución, con comentario opcional.
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS return_id bigint REFERENCES returns (id) ON DELETE CASCADE;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS comment   text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ratings_comment_len') THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_comment_len CHECK (char_length(comment) <= 280);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ratings_return_author_key') THEN
    ALTER TABLE ratings ADD CONSTRAINT ratings_return_author_key UNIQUE (return_id, author_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ratings_return_idx ON ratings (return_id);

-- thanks: un agradecimiento público por devolución.
CREATE TABLE IF NOT EXISTS thanks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id    bigint      NOT NULL REFERENCES returns (id) ON DELETE CASCADE,
  author_id    text        NOT NULL REFERENCES users (id) ON DELETE CASCADE,   -- quien recuperó
  recipient_id text        NOT NULL REFERENCES users (id) ON DELETE CASCADE,   -- quien devolvió
  message      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thanks_return_key UNIQUE (return_id),
  CONSTRAINT thanks_not_self CHECK (author_id <> recipient_id),
  CONSTRAINT thanks_message_len CHECK (char_length(message) BETWEEN 1 AND 500)
);

CREATE INDEX IF NOT EXISTS thanks_recipient_idx ON thanks (recipient_id, created_at DESC);

COMMIT;
