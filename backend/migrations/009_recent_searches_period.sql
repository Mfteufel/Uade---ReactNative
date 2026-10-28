-- 009_recent_searches_period.sql — Período original de las búsquedas recientes.
-- Idempotente: ADD COLUMN IF NOT EXISTS, constraint dentro de DO.
-- Reversión: migrations/rollback/009_recent_searches_period.down.sql (no la aplica migrate.js).
-- Requiere 008 (recent_searches).
--
-- Antes, "hoy", "3d" y "7d" se guardaban como date_from/date_to del día de guardado, y al repetir la búsqueda
-- se perdía lo relativo. Ahora se guarda el período y, solo con 'range', las fechas.
--   period: today | 3d | 7d | range. NULL = fila anterior a esta migración (se lee como rango si tiene fechas).
-- Las filas existentes no se tocan.

BEGIN;

ALTER TABLE recent_searches ADD COLUMN IF NOT EXISTS period text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recent_searches_period_valid') THEN
    ALTER TABLE recent_searches
      ADD CONSTRAINT recent_searches_period_valid CHECK (period IS NULL OR period IN ('today', '3d', '7d', 'range'));
  END IF;
END $$;

COMMIT;
