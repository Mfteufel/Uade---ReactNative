-- Reversión de 003_users_profile.sql. Correr DESPUÉS de revertir 004 a 008.
-- Solo quita lo agregado por 003: users.neighborhood (texto), fotos y demás datos previos no se tocan.
-- Se pierden únicamente neighborhood_id, updated_at, photos.kind y user_badges.
-- Aplicar a mano: node --env-file=... (o psql "$DATABASE_URL" -f migrations/rollback/003_users_profile.down.sql)
BEGIN;
DROP TABLE IF EXISTS user_badges;
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_kind_valid;
ALTER TABLE photos DROP COLUMN IF EXISTS kind;
DROP INDEX IF EXISTS users_neighborhood_id_idx;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_neighborhood_id_fkey;
ALTER TABLE users DROP COLUMN IF EXISTS neighborhood_id;
DROP TRIGGER IF EXISTS users_set_updated_at ON users;
ALTER TABLE users DROP COLUMN IF EXISTS updated_at;
DELETE FROM schema_migrations WHERE name = '003_users_profile.sql';
COMMIT;
