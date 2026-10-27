-- Reversión de 009_recent_searches_period.sql. Correr ANTES de revertir 008 y las anteriores.
-- Quita recent_searches.period (con su constraint). Se pierde el período original: las filas relativas (hoy, 3d, 7d)
-- quedan sin fechas, es decir, sin filtro de período.
-- Aplicar a mano (no la toma migrate.js): psql "$DATABASE_URL" -f migrations/rollback/009_recent_searches_period.down.sql
BEGIN;
ALTER TABLE recent_searches DROP CONSTRAINT IF EXISTS recent_searches_period_valid;
ALTER TABLE recent_searches DROP COLUMN IF EXISTS period;
DELETE FROM schema_migrations WHERE name = '009_recent_searches_period.sql';
COMMIT;
