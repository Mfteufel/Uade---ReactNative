-- Reversión de 002_catalogs.sql. Correr DESPUÉS de revertir 003 a 008.
-- Aplicar a mano (no la toma migrate.js): psql "$DATABASE_URL" -f migrations/rollback/002_catalogs.down.sql
BEGIN;
DROP TABLE IF EXISTS badges;
DROP TABLE IF EXISTS neighborhoods;
DROP TABLE IF EXISTS categories;
DROP FUNCTION IF EXISTS set_updated_at();
DELETE FROM schema_migrations WHERE name = '002_catalogs.sql';
COMMIT;
