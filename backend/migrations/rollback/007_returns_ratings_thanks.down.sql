-- Reversión de 007_returns_ratings_thanks.sql.
-- Borra thanks y las columnas agregadas a returns y ratings (con sus constraints e índices).
-- NO toca las filas ni las columnas originales de returns y ratings (reputación intacta).
-- Si ya hay ratings con return_id o returns con claim_id, esa información se pierde.
-- Correr ANTES de revertir 006, 005 y 004 (las columnas apuntan a claims y meeting_points).
-- Aplicar a mano (no la toma migrate.js): node --env-file=... o psql "$DATABASE_URL" -f migrations/rollback/007_returns_ratings_thanks.down.sql
BEGIN;
DROP TABLE IF EXISTS thanks;
ALTER TABLE ratings DROP COLUMN IF EXISTS return_id;   -- arrastra UNIQUE (return_id, author_id) e índice
ALTER TABLE ratings DROP COLUMN IF EXISTS comment;     -- arrastra el CHECK de 280
ALTER TABLE returns DROP COLUMN IF EXISTS recovered_by_id;  -- arrastra CHECK e índice
ALTER TABLE returns DROP COLUMN IF EXISTS claim_id;         -- arrastra UNIQUE
ALTER TABLE returns DROP COLUMN IF EXISTS meeting_point_id;
DELETE FROM schema_migrations WHERE name = '007_returns_ratings_thanks.sql';
COMMIT;
