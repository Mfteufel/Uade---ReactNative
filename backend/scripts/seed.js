const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { BCRYPT_COST } = require('../src/services/tokens');

const PASSWORD = 'hallado123';

// Mismos datos que src/api/mock/seed.js de la app.
const USERS = [
  { id: 'u_lucia', email: 'lucia@hallado.com', name: 'Lucía Fernández', neighborhood: 'Palermo',
    phone: '+54 11 5555-0001', visible: true, createdAt: '2024-03-10T12:00:00.000Z', returns: 12, pos: 18, neg: 1 },
  { id: 'u_martin', email: 'martin@hallado.com', name: 'Martín Gómez', neighborhood: 'Caballito',
    phone: '+54 11 5555-0002', visible: false, createdAt: '2025-06-01T12:00:00.000Z', returns: 5, pos: 6, neg: 0 },
  { id: 'u_carlos', email: 'carlos@hallado.com', name: 'Carlos Ruiz', neighborhood: 'Belgrano',
    phone: '+54 11 5555-0003', visible: true, createdAt: '2025-11-20T12:00:00.000Z', returns: 2, pos: 1, neg: 3 },
  { id: 'u_sofia', email: 'sofia@hallado.com', name: 'Sofía Paz', neighborhood: 'Villa Urquiza',
    phone: '', visible: false, createdAt: '2026-09-15T12:00:00.000Z', returns: 0, pos: 0, neg: 0 },
];

// Fecha i-ésima de n, repartidas entre (alta + 1 día) y hace 2 días.
function spread(user, i, n) {
  const from = new Date(user.createdAt).getTime() + 86400000;
  const to = Math.max(from, Date.now() - 2 * 86400000);
  return new Date(from + ((to - from) * (i + 1)) / (n + 1)).toISOString();
}

async function main() {
  const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST);
  const ids = USERS.map((u) => u.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Borra solo estos usuarios (returns, ratings, photos, tokens caen por CASCADE).
    await client.query('DELETE FROM ratings WHERE rated_user_id = ANY($1) OR author_id = ANY($1)', [ids]);
    await client.query('DELETE FROM users WHERE id = ANY($1) OR email = ANY($2)', [ids, USERS.map((u) => u.email)]);

    for (const u of USERS) {
      await client.query(
        `INSERT INTO users (id, email, password_hash, name, neighborhood, phone, phone_visible_on_claim, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [u.id, u.email, hash, u.name, u.neighborhood, u.phone, u.visible, u.createdAt]
      );
    }
    for (const u of USERS) {
      for (let i = 0; i < u.returns; i++) {
        await client.query('INSERT INTO returns (user_id, created_at) VALUES ($1,$2)', [u.id, spread(u, i, u.returns)]);
      }
      const others = ids.filter((id) => id !== u.id);
      const total = u.pos + u.neg;
      for (let i = 0; i < total; i++) {
        // Las negativas van intercaladas al final; autores rotan entre los otros usuarios.
        const positive = i < u.pos;
        await client.query(
          'INSERT INTO ratings (rated_user_id, author_id, positive, created_at) VALUES ($1,$2,$3,$4)',
          [u.id, others[i % others.length], positive, spread(u, i, total)]
        );
      }
    }
    await client.query('COMMIT');
    console.log(`Seed cargado: ${USERS.length} usuarios.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
