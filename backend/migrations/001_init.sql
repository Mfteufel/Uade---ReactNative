-- 001_init.sql — Esquema inicial de Hallado (auth, perfil, foto, reputación).
-- Requiere PostgreSQL 13+ (gen_random_uuid() viene incluido).
-- Idempotente: se puede correr más de una vez sin romper nada.

BEGIN;

-- ---------------------------------------------------------------------------
-- users: datos propios del usuario (objeto User del contrato).
-- photo_id se crea sin FK; la FK a photos se agrega al final para cortar el ciclo
-- users <-> photos (photos.user_id apunta a users).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                     text PRIMARY KEY,                -- ej. 'u_lucia'; lo genera el backend
  email                  text NOT NULL UNIQUE,            -- siempre en minúsculas (ver CHECK)
  password_hash          text NOT NULL,                   -- bcrypt
  name                   text NOT NULL,                   -- al registrarse: parte del email antes de la '@'
  photo_id               uuid,                            -- foto actual (null = sin foto)
  neighborhood           text NOT NULL DEFAULT '',        -- el mock usa '' cuando no hay dato
  phone                  text NOT NULL DEFAULT '',
  phone_visible_on_claim boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),  -- también es memberSince del perfil público
  CONSTRAINT users_email_lower CHECK (email = lower(btrim(email))),
  CONSTRAINT users_name_not_empty CHECK (btrim(name) <> '')
);
-- La restricción UNIQUE de email ya crea su índice; no hace falta otro.

-- ---------------------------------------------------------------------------
-- otp_codes: códigos de 6 dígitos para registro y para recuperar contraseña.
-- used_at se completa cuando el código se usa O se invalida (nuevo pedido,
-- 5 intentos fallidos o vencido). Un código "activo" es el que tiene used_at null.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_codes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL,                     -- sin FK: en el registro todavía no existe el usuario
  purpose    text NOT NULL,
  code_hash  text NOT NULL,                     -- hash del código, nunca el código en claro
  expires_at timestamptz NOT NULL,              -- created_at + 10 min
  attempts   int NOT NULL DEFAULT 0,            -- intentos fallidos (máx. 5)
  created_at timestamptz NOT NULL DEFAULT now(),-- se usa para el límite de 60 s entre envíos
  used_at    timestamptz,
  CONSTRAINT otp_purpose_valid CHECK (purpose IN ('register', 'reset')),
  CONSTRAINT otp_email_lower CHECK (email = lower(btrim(email))),
  CONSTRAINT otp_attempts_range CHECK (attempts BETWEEN 0 AND 5)
);

-- Buscar el último código de un email para un propósito (verificar y chequear los 60 s).
CREATE INDEX IF NOT EXISTS otp_codes_email_purpose_idx
  ON otp_codes (email, purpose, created_at DESC);

-- A lo sumo un código activo por email+propósito: antes de insertar uno nuevo,
-- el backend tiene que marcar el anterior con used_at (en la misma transacción).
CREATE UNIQUE INDEX IF NOT EXISTS otp_codes_one_active_idx
  ON otp_codes (email, purpose)
  WHERE used_at IS NULL;

-- ---------------------------------------------------------------------------
-- refresh_tokens: se guarda solo el hash. En /auth/refresh se revoca el usado
-- y se emite uno nuevo (rotación).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,              -- sha256 del token (búsqueda directa por hash)
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz                        -- null = vigente (si no venció)
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- photos: la imagen se guarda en la base (bytea). photoUri del contrato se arma
-- como PUBLIC_URL + '/photos/' + id. id uuid para que no se puedan recorrer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  data       bytea NOT NULL,
  mime       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photos_mime_image CHECK (mime LIKE 'image/%')
);

CREATE INDEX IF NOT EXISTS photos_user_idx ON photos (user_id);

-- Cierre del ciclo: users.photo_id -> photos.id. Si se borra la foto, el usuario
-- queda sin foto (SET NULL). ADD CONSTRAINT no tiene IF NOT EXISTS, por eso el DO.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_photo_id_fkey') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_photo_id_fkey
      FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- returns: devoluciones completadas por el usuario (completedReturns = count).
-- Cuando existan los reclamos se le puede agregar claim_id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returns (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS returns_user_idx ON returns (user_id);

-- ---------------------------------------------------------------------------
-- ratings: valoraciones positivas/negativas (positiveRatings / negativeRatings).
-- Sin UNIQUE (rated, author): la misma persona puede valorar varias veces
-- (una por devolución), y el seed lo necesita (Lucía tiene 18 positivas).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ratings (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rated_user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_id     text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  positive      boolean NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ratings_not_self CHECK (rated_user_id <> author_id)
);

-- Incluye positive para contar positivas/negativas con un solo índice.
CREATE INDEX IF NOT EXISTS ratings_rated_user_idx ON ratings (rated_user_id, positive);
CREATE INDEX IF NOT EXISTS ratings_author_idx ON ratings (author_id);

COMMIT;
