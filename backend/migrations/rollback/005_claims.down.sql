-- Reversión de 005_claims.sql. Correr DESPUÉS de revertir 006 a 008.
-- Borra claims (y sus índices, constraints y trigger).
-- No toca photos: las fotos de reclamos quedan huérfanas y se pueden limpiar a mano.
-- Aplicar a mano (no la toma migrate.js): node --env-file=... o psql "$DATABASE_URL" -f migrations/rollback/005_claims.down.sql
BEGIN;
DROP TABLE IF EXISTS claims;
DELETE FROM schema_migrations WHERE name = '005_claims.sql';
COMMIT;
