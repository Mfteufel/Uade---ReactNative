-- Reversión de 004_publications.sql. Correr DESPUÉS de revertir 005 a 008.
-- Borra publications y publication_photos (y sus índices, constraints y trigger).
-- No toca photos: las filas de photos con kind = 'publication' quedan huérfanas y se pueden limpiar a mano.
-- Aplicar a mano (no la toma migrate.js): node --env-file=... o psql "$DATABASE_URL" -f migrations/rollback/004_publications.down.sql
BEGIN;
DROP TABLE IF EXISTS publication_photos;
DROP TABLE IF EXISTS publications;
DELETE FROM schema_migrations WHERE name = '004_publications.sql';
COMMIT;
