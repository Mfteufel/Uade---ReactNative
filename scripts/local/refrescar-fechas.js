// Refresca las fechas de los datos de ejemplo (_seed_) para que "hoy", "últimos 3 días" y el reclamo
// pendiente vuelvan a verse como recién sembrados. seed_demo.js usa ON CONFLICT DO NOTHING, así que
// en una base ya sembrada esas fechas envejecen.
// Uso: npm run db:refrescar-fechas            (base local)
//      npm run db:refrescar-fechas -- --neon  (base compartida de pruebas; pide confirmar el host)
// Solo hace UPDATE (nunca INSERT ni DELETE), en una transacción, sobre ids de ejemplo exactos.
// Idempotente: cada corrida deja los mismos valores relativos a ese momento.
// REGLA: nunca lee backend/.env; la conexión sale del archivo .env.demo.* elegido.
const path = require('path');

// Variables de libpq que pg lee solas: vacías para que nada del entorno cambie el destino o el SSL.
for (const k of ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGOPTIONS', 'PGSERVICE']) {
  process.env[k] = '';
}

const { abortar, leerEnv, asegurarEnv, guardaBase } = require('./comun');
const { Pool } = require(path.join('..', '..', 'backend', 'node_modules', 'pg'));

const DAY = 86400000;
const HOUR = 3600000;

// Ids de ejemplo exactos (los de backend/scripts/seed_demo.js). Nada de LIKE ni de emails.
const IDS = {
  pubs: ['p_seed_01', 'p_seed_02', 'p_seed_03', 'p_seed_04', 'p_seed_05', 'p_seed_06', 'p_seed_07'],
  claims: ['c_seed_01', 'c_seed_02', 'c_seed_03'],
  meetings: ['m_seed_01', 'm_seed_02'],
  alerts: ['a_seed_01', 'a_seed_02', 'a_seed_03'],
  searches: ['5eed0000-0000-4000-8000-0000000000b1', '5eed0000-0000-4000-8000-0000000000b2'],
};
const U_BRUNO = 'u_seed_bruno';
const U_DIEGO = 'u_seed_diego';
const U_CARLA = 'u_seed_carla';

// Desfases respecto de "ahora". Mantener sincronizado con seed_demo.js.
// Publicaciones: días atrás de occurred_on/created_at; vencen en ahora + 25 días (la vencida, hace 15).
const PUBS = {
  p_seed_01: { dias: 3 }, p_seed_02: { dias: 6 }, p_seed_03: { dias: 4 }, p_seed_04: { dias: 1 },
  p_seed_05: { dias: 2 }, p_seed_06: { dias: 45, vencida: true }, p_seed_07: { dias: 5 },
};
// Reclamos: [created_at, decided_at, expires_at] en ms respecto de ahora (negativo = pasado).
const CLAIMS = {
  c_seed_01: [-(4 * DAY + 20 * HOUR), -4 * DAY, -(3 * DAY + 12 * HOUR)],
  c_seed_02: [-2 * HOUR, null, 46 * HOUR],
  c_seed_03: [-(3 * DAY + 12 * HOUR), -(2 * DAY + 12 * HOUR), -1 * DAY],
};
// Puntos de encuentro: [meet_at, responded_at, created_at].
const MEETINGS = {
  m_seed_01: [-2 * DAY, -(2 * DAY + 6 * HOUR), -(2 * DAY + 10 * HOUR)],
  m_seed_02: [-(1 * DAY + 12 * HOUR), -2 * DAY, -(2 * DAY + 4 * HOUR)],
};

async function main() {
  const args = process.argv.slice(2);
  const neon = args.includes('--neon');
  // --env=<archivo>: solo para pruebas; las guardas de host valen igual.
  const envArg = args.find((a) => a.startsWith('--env='));
  const archivo = envArg ? path.resolve(envArg.slice(6)) : asegurarEnv({ neon });
  const url = leerEnv(archivo).DATABASE_URL;
  const host = await guardaBase(url, { neon, nombre: 'DATABASE_URL' });
  console.log(`Modo: ${neon ? `Neon: ${host}` : 'local'}`);

  const ahora = Date.now();
  const rel = (ms) => (ms === null ? null : new Date(ahora + ms).toISOString());
  const dia = (diasAtras) => new Date(ahora - diasAtras * DAY).toISOString().slice(0, 10);
  const cuenta = {};
  const sumar = (tabla, r) => { cuenta[tabla] = (cuenta[tabla] || 0) + r.rowCount; };

  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 8000 });
  const client = await pool.connect();
  let restauracion;
  try {
    await client.query('BEGIN');

    // Reclamo pendiente vencido por el barrido (expireDueClaims solo pone status='expired' y decided_at=now()).
    // Se restaura solo si nada indica un cambio posterior del equipo; si no, c_seed_02 y p_seed_03 no se tocan.
    const { rows: [c2] } = await client.query(
      `SELECT status, decided_at, expires_at, verification_answer, description, photo_id, attempt_number,
              found_neighborhood_id, claimer_id, publisher_id, publication_id, type
         FROM claims WHERE id = $1 FOR UPDATE`, ['c_seed_02']);
    let tocarC2 = false; // si se actualizan las fechas de c_seed_02 y p_seed_03
    let restaurar = false;
    if (!c2) {
      restauracion = 'c_seed_02 no existe: no se toca nada de c_seed_02 ni de p_seed_03.';
    } else if (c2.status === 'pending') {
      tocarC2 = true;
      restauracion = 'c_seed_02 ya estaba pendiente: solo se renovaron sus fechas.';
    } else if (c2.status !== 'expired') {
      restauracion = `c_seed_02 está "${c2.status}" (no vencido): no se toca c_seed_02 ni p_seed_03.`;
    } else {
      const fallas = [];
      // (a) lo que deja el barrido y nada más: datos originales del seed intactos.
      const original = c2.verification_answer === '1990' && c2.description === 'Me equivoqué en el año, es el mío'
        && c2.photo_id === null && c2.attempt_number === 2 && c2.found_neighborhood_id === null
        && c2.claimer_id === U_DIEGO && c2.publisher_id === U_CARLA && c2.publication_id === 'p_seed_03' && c2.type === 'mine';
      if (!original || !c2.decided_at || new Date(c2.expires_at) > new Date(c2.decided_at)) {
        fallas.push('(a) c_seed_02 tiene datos o fechas que no son los que deja el barrido');
      }
      // (b) ningún otro reclamo sobre p_seed_03 aparte de c_seed_01 y c_seed_02.
      const otros = await client.query(
        `SELECT 1 FROM claims WHERE publication_id = $1 AND NOT (id = ANY($2))`, ['p_seed_03', ['c_seed_01', 'c_seed_02']]);
      if (otros.rowCount > 0) fallas.push('(b) hay otros reclamos sobre p_seed_03');
      // (c) c_seed_01 sigue rechazado.
      const c1 = await client.query(`SELECT status FROM claims WHERE id = $1`, ['c_seed_01']);
      if (c1.rowCount !== 1 || c1.rows[0].status !== 'rejected') fallas.push('(c) c_seed_01 ya no está rechazado');
      // (d) el barrido no toca la publicación: sigue in_claim y sin cambio de estado posterior al vencimiento.
      const p3 = await client.query(`SELECT status, status_changed_at FROM publications WHERE id = $1`, ['p_seed_03']);
      if (p3.rowCount !== 1 || p3.rows[0].status !== 'in_claim'
          || (c2.decided_at && new Date(p3.rows[0].status_changed_at) > new Date(c2.decided_at))) {
        fallas.push('(d) p_seed_03 no está in_claim o cambió de estado después del vencimiento');
      }
      // (e) sin puntos de encuentro sobre c_seed_02.
      const mp = await client.query(`SELECT 1 FROM meeting_points WHERE claim_id = $1`, ['c_seed_02']);
      if (mp.rowCount > 0) fallas.push('(e) hay puntos de encuentro sobre c_seed_02');

      if (fallas.length === 0) {
        tocarC2 = true;
        restaurar = true;
        restauracion = 'c_seed_02 restaurado a pending y p_seed_03 a in_claim.';
      } else {
        restauracion = `NO se restauró c_seed_02 ni p_seed_03 (no se tocaron). Condiciones que fallaron: ${fallas.join('; ')}.`;
      }
    }

    // Publicaciones. p_seed_03 solo junto con c_seed_02; el status no se cambia salvo su restauración.
    for (const id of IDS.pubs) {
      if (id === 'p_seed_03' && !tocarC2) continue;
      const p = PUBS[id];
      const creada = rel(-p.dias * DAY);
      const r = await client.query(
        `UPDATE publications SET occurred_on = $2, created_at = $3, status_changed_at = $3, expires_at = $4,
                status = CASE WHEN $5::boolean THEN 'in_claim' ELSE status END
          WHERE id = $1 AND id = ANY($6)`,
        [id, dia(p.dias), creada, p.vencida ? rel(-15 * DAY) : rel(25 * DAY), id === 'p_seed_03' && restaurar, IDS.pubs]
      );
      sumar('publications', r);
    }

    // Reclamos. c_seed_02 solo si corresponde; al restaurar vuelve a pending y sin decided_at.
    for (const id of IDS.claims) {
      if (id === 'c_seed_02' && !tocarC2) continue;
      const [creado, decidido, vence] = CLAIMS[id];
      const r = await client.query(
        `UPDATE claims SET created_at = $2, decided_at = $3, expires_at = $4,
                status = CASE WHEN $5::boolean THEN 'pending' ELSE status END
          WHERE id = $1 AND id = ANY($6)`,
        [id, rel(creado), rel(decidido), rel(vence), id === 'c_seed_02' && restaurar, IDS.claims]
      );
      sumar('claims', r);
    }

    for (const id of IDS.meetings) {
      const [meet, resp, creado] = MEETINGS[id];
      sumar('meeting_points', await client.query(
        `UPDATE meeting_points SET meet_at = $2, responded_at = $3, created_at = $4 WHERE id = $1 AND id = ANY($5)`,
        [id, rel(meet), rel(resp), rel(creado), IDS.meetings]));
    }

    // Devolución, calificación, agradecimiento e insignia del reclamo aceptado: sus fechas siguen al reclamo.
    const { rows: [ret] } = await client.query(`SELECT id FROM returns WHERE claim_id = $1`, ['c_seed_03']);
    if (ret) {
      sumar('returns', await client.query(`UPDATE returns SET created_at = $2 WHERE id = $1`, [ret.id, rel(-1 * DAY)]));
      sumar('ratings', await client.query(
        `UPDATE ratings SET created_at = $3 WHERE return_id = $1 AND author_id = $2`, [ret.id, U_BRUNO, rel(-20 * HOUR)]));
      sumar('thanks', await client.query(
        `UPDATE thanks SET created_at = $3 WHERE return_id = $1 AND author_id = $2`, [ret.id, U_BRUNO, rel(-19 * HOUR)]));
      sumar('user_badges', await client.query(
        `UPDATE user_badges SET earned_at = $3 WHERE user_id = $1 AND badge_id = $2`, [U_CARLA, 'first_return', rel(-1 * DAY)]));
    }

    for (const id of IDS.alerts) {
      sumar('alerts', await client.query(
        `UPDATE alerts SET last_seen_at = $2, created_at = $2 WHERE id = $1 AND id = ANY($3)`,
        [id, rel(-10 * DAY), IDS.alerts]));
    }

    // Seguidas de ejemplo (clave: usuario + publicación).
    sumar('follows', await client.query(
      `UPDATE follows SET seen_at = $3, created_at = $3 WHERE user_id = $1 AND publication_id = $2`,
      [U_BRUNO, 'p_seed_01', rel(-5 * DAY)]));
    sumar('follows', await client.query(
      `UPDATE follows SET seen_at = $3, created_at = $3 WHERE user_id = $1 AND publication_id = $2`,
      [U_DIEGO, 'p_seed_05', rel(-1 * HOUR)]));

    sumar('recent_searches', await client.query(
      `UPDATE recent_searches SET created_at = $2, date_from = $3, date_to = $4 WHERE id = $1 AND id = ANY($5)`,
      [IDS.searches[0], rel(-2 * HOUR), dia(30), dia(0), IDS.searches]));
    sumar('recent_searches', await client.query(
      `UPDATE recent_searches SET created_at = $2 WHERE id = $1 AND id = ANY($3)`,
      [IDS.searches[1], rel(-5 * HOUR), IDS.searches]));

    await client.query('COMMIT');
    console.log('Filas actualizadas por tabla:');
    for (const [t, n] of Object.entries(cuenta)) console.log(`  ${t}: ${n}`);
    console.log(restauracion);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => abortar(e.message));
