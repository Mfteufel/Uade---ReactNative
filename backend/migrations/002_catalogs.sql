-- 002_catalogs.sql — Catálogos de Hallado: categorías, barrios e insignias, más set_updated_at().
-- Idempotente: las tablas usan IF NOT EXISTS y los datos ON CONFLICT DO NOTHING.
-- Reversión: migrations/rollback/002_catalogs.down.sql (no la aplica migrate.js).
-- Las FK hacia estos catálogos serán ON DELETE RESTRICT (no se borra algo en uso).

BEGIN;

-- Función única para mantener updated_at; cada tabla la usa con un trigger BEFORE UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         text PRIMARY KEY,                 -- slug estable, ej. 'keys'
  name       text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  CONSTRAINT categories_name_not_empty CHECK (btrim(name) <> '')
);

INSERT INTO categories (id, name, sort_order) VALUES
  ('documents',   'Documentos',  1),
  ('keys',        'Llaves',      2),
  ('electronics', 'Electrónica', 3),
  ('pets',        'Mascotas',    4),
  ('clothing',    'Ropa',        5),
  ('other',       'Otros',       6)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- neighborhoods: 48 barrios de CABA y algunas localidades del GBA.
-- Los centros son aproximados (sirven para ubicar en el mapa, no para medir).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS neighborhoods (
  id         text PRIMARY KEY,                 -- slug sin acentos, ej. 'villa-crespo'
  name       text NOT NULL,
  locality   text NOT NULL,                    -- 'CABA' o 'GBA'
  center_lat numeric(9,6) NOT NULL,
  center_lng numeric(9,6) NOT NULL,
  CONSTRAINT neighborhoods_name_not_empty CHECK (btrim(name) <> ''),
  CONSTRAINT neighborhoods_locality_not_empty CHECK (btrim(locality) <> ''),
  CONSTRAINT neighborhoods_lat_valid CHECK (center_lat BETWEEN -90 AND 90),
  CONSTRAINT neighborhoods_lng_valid CHECK (center_lng BETWEEN -180 AND 180)
);
CREATE UNIQUE INDEX IF NOT EXISTS neighborhoods_name_locality_key
  ON neighborhoods (lower(name), locality);

INSERT INTO neighborhoods (id, name, locality, center_lat, center_lng) VALUES
  ('agronomia', 'Agronomía', 'CABA', -34.5938, -58.4936),
  ('almagro', 'Almagro', 'CABA', -34.6097, -58.4208),
  ('balvanera', 'Balvanera', 'CABA', -34.6097, -58.4016),
  ('barracas', 'Barracas', 'CABA', -34.6439, -58.3816),
  ('belgrano', 'Belgrano', 'CABA', -34.5627, -58.4583),
  ('boedo', 'Boedo', 'CABA', -34.6270, -58.4196),
  ('caballito', 'Caballito', 'CABA', -34.6186, -58.4425),
  ('chacarita', 'Chacarita', 'CABA', -34.5875, -58.4533),
  ('coghlan', 'Coghlan', 'CABA', -34.5603, -58.4742),
  ('colegiales', 'Colegiales', 'CABA', -34.5738, -58.4489),
  ('constitucion', 'Constitución', 'CABA', -34.6273, -58.3813),
  ('flores', 'Flores', 'CABA', -34.6286, -58.4631),
  ('floresta', 'Floresta', 'CABA', -34.6290, -58.4818),
  ('la-boca', 'La Boca', 'CABA', -34.6345, -58.3631),
  ('la-paternal', 'La Paternal', 'CABA', -34.5972, -58.4686),
  ('liniers', 'Liniers', 'CABA', -34.6439, -58.5206),
  ('mataderos', 'Mataderos', 'CABA', -34.6603, -58.5060),
  ('monte-castro', 'Monte Castro', 'CABA', -34.6173, -58.5047),
  ('montserrat', 'Montserrat', 'CABA', -34.6122, -58.3814),
  ('nueva-pompeya', 'Nueva Pompeya', 'CABA', -34.6495, -58.4122),
  ('nunez', 'Núñez', 'CABA', -34.5436, -58.4636),
  ('palermo', 'Palermo', 'CABA', -34.5790, -58.4298),
  ('parque-avellaneda', 'Parque Avellaneda', 'CABA', -34.6475, -58.4767),
  ('parque-chacabuco', 'Parque Chacabuco', 'CABA', -34.6361, -58.4361),
  ('parque-chas', 'Parque Chas', 'CABA', -34.5856, -58.4797),
  ('parque-patricios', 'Parque Patricios', 'CABA', -34.6361, -58.4008),
  ('puerto-madero', 'Puerto Madero', 'CABA', -34.6118, -58.3637),
  ('recoleta', 'Recoleta', 'CABA', -34.5875, -58.3974),
  ('retiro', 'Retiro', 'CABA', -34.5917, -58.3743),
  ('saavedra', 'Saavedra', 'CABA', -34.5528, -58.4875),
  ('san-cristobal', 'San Cristóbal', 'CABA', -34.6217, -58.4005),
  ('san-nicolas', 'San Nicolás', 'CABA', -34.6040, -58.3830),
  ('san-telmo', 'San Telmo', 'CABA', -34.6218, -58.3715),
  ('velez-sarsfield', 'Vélez Sarsfield', 'CABA', -34.6374, -58.4949),
  ('versalles', 'Versalles', 'CABA', -34.6290, -58.5200),
  ('villa-crespo', 'Villa Crespo', 'CABA', -34.5995, -58.4392),
  ('villa-del-parque', 'Villa del Parque', 'CABA', -34.6054, -58.4929),
  ('villa-devoto', 'Villa Devoto', 'CABA', -34.6008, -58.5116),
  ('villa-general-mitre', 'Villa General Mitre', 'CABA', -34.6082, -58.4710),
  ('villa-lugano', 'Villa Lugano', 'CABA', -34.6760, -58.4690),
  ('villa-luro', 'Villa Luro', 'CABA', -34.6330, -58.5040),
  ('villa-ortuzar', 'Villa Ortúzar', 'CABA', -34.5800, -58.4680),
  ('villa-pueyrredon', 'Villa Pueyrredón', 'CABA', -34.5775, -58.5000),
  ('villa-real', 'Villa Real', 'CABA', -34.6177, -58.5217),
  ('villa-riachuelo', 'Villa Riachuelo', 'CABA', -34.6838, -58.4790),
  ('villa-santa-rita', 'Villa Santa Rita', 'CABA', -34.6050, -58.4800),
  ('villa-soldati', 'Villa Soldati', 'CABA', -34.6665, -58.4400),
  ('villa-urquiza', 'Villa Urquiza', 'CABA', -34.5740, -58.4900),
  ('vicente-lopez', 'Vicente López', 'GBA', -34.5262, -58.4750),
  ('san-isidro', 'San Isidro', 'GBA', -34.4708, -58.5286),
  ('tigre', 'Tigre', 'GBA', -34.4260, -58.5797),
  ('san-martin', 'San Martín', 'GBA', -34.5750, -58.5370),
  ('moron', 'Morón', 'GBA', -34.6534, -58.6198),
  ('lanus', 'Lanús', 'GBA', -34.7000, -58.3917),
  ('avellaneda', 'Avellaneda', 'GBA', -34.6620, -58.3650),
  ('lomas-de-zamora', 'Lomas de Zamora', 'GBA', -34.7600, -58.4000),
  ('quilmes', 'Quilmes', 'GBA', -34.7206, -58.2546),
  ('tres-de-febrero', 'Tres de Febrero', 'GBA', -34.6030, -58.5640)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- badges: catálogo de insignias (debe coincidir con src/constants/badges.js).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS badges (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text NOT NULL,
  icon        text NOT NULL,
  metric      text NOT NULL,
  goal        int  NOT NULL,
  CONSTRAINT badges_metric_valid CHECK (metric IN ('completedReturns', 'positiveRatings', 'points')),
  CONSTRAINT badges_goal_positive CHECK (goal > 0)
);

INSERT INTO badges (id, name, description, icon, metric, goal) VALUES
  ('first_return', 'Primer paso', '1 devolución concretada', '🌱', 'completedReturns', 1),
  ('solidary_neighbor', 'Vecino solidario', '5 devoluciones concretadas', '🤝', 'completedReturns', 5),
  ('neighborhood_guardian', 'Guardián del barrio', '10 devoluciones concretadas', '🛡️', 'completedReturns', 10),
  ('well_rated', 'Muy valorado', '10 valoraciones positivas', '⭐', 'positiveRatings', 10)
ON CONFLICT (id) DO NOTHING;

COMMIT;
