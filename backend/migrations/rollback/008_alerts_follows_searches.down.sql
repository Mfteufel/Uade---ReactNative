-- Reversión de 008_alerts_follows_searches.sql. Correr ANTES de revertir 007 y las anteriores.
-- Borra alerts, follows y recent_searches (con sus índices, constraints y trigger). Se pierden sus filas.
-- Aplicar a mano (no la toma migrate.js): node --env-file=... o psql "$DATABASE_URL" -f migrations/rollback/008_alerts_follows_searches.down.sql
BEGIN;
DROP TABLE IF EXISTS recent_searches;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS alerts;
DELETE FROM schema_migrations WHERE name = '008_alerts_follows_searches.sql';
COMMIT;
