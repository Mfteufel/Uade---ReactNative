-- Reversión de 006_meeting_points.sql. Correr DESPUÉS de revertir 007 y 008.
-- Borra meeting_points (y sus índices, constraints y trigger).
-- Aplicar a mano (no la toma migrate.js): node --env-file=... o psql "$DATABASE_URL" -f migrations/rollback/006_meeting_points.down.sql
BEGIN;
DROP TABLE IF EXISTS meeting_points;
DELETE FROM schema_migrations WHERE name = '006_meeting_points.sql';
COMMIT;
