// Seed de datos de ejemplo (esquema completo 001-008). NO borra ni actualiza nada:
// todo es INSERT ... ON CONFLICT DO NOTHING, así que se puede correr varias veces.
// Todos los ids llevan el prefijo "_seed_" / "seed" para poder limpiarlos fácil.
// Barrios: solo de CABA (ids reales de la tabla neighborhoods, cargada por 002).
//
// Uso (SOLO contra la base de pruebas):
//   SEED_DEMO_ALLOWED_HOST_PREFIX=<prefijo-del-endpoint> \
//   node --env-file=<archivo-con-DATABASE_URL> scripts/seed_demo.js
// No usa dotenv ni backend/.env: toma DATABASE_URL del entorno y se niega a
// correr si el host no empieza con el prefijo indicado en
// SEED_DEMO_ALLOWED_HOST_PREFIX (obligatoria, sin valor por defecto).
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Prefijo de host permitido: obligatorio, sin valor por defecto.
const ALLOWED_HOST_PREFIX = process.env.SEED_DEMO_ALLOWED_HOST_PREFIX;
if (!ALLOWED_HOST_PREFIX) {
  console.error('Falta SEED_DEMO_ALLOWED_HOST_PREFIX: definila con el prefijo del endpoint de la base de pruebas (el inicio del host de DATABASE_URL).');
  process.exit(1);
}
const PASSWORD = 'hallado123'; // clave de prueba conocida, nunca una real
const BCRYPT_COST = 10; // el mismo que src/services/tokens.js

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL (usá --env-file con el archivo que la define).');
  process.exit(1);
}
if (!new URL(url).hostname.startsWith(ALLOWED_HOST_PREFIX)) {
  console.error('PROBLEMA: DATABASE_URL no coincide con SEED_DEMO_ALLOWED_HOST_PREFIX; no se ejecuta el seed.');
  process.exit(1);
}
const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 8000 });

const DAY = 86400000;
const HOUR = 3600000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const ahead = (ms) => new Date(Date.now() + ms).toISOString();
const day = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);

// Barrios reales de CABA (ids de neighborhoods).
const USERS = [
  { id: 'u_seed_ana', email: 'ana.seed@hallado.com', name: 'Ana Seed', hood: 'palermo', hoodName: 'Palermo', phone: '+54 11 5555-1001', visible: true, daysOld: 120 },
  { id: 'u_seed_bruno', email: 'bruno.seed@hallado.com', name: 'Bruno Seed', hood: 'caballito', hoodName: 'Caballito', phone: '+54 11 5555-1002', visible: true, daysOld: 90 },
  { id: 'u_seed_carla', email: 'carla.seed@hallado.com', name: 'Carla Seed', hood: 'belgrano', hoodName: 'Belgrano', phone: '', visible: false, daysOld: 80 },
  { id: 'u_seed_diego', email: 'diego.seed@hallado.com', name: 'Diego Seed', hood: 'villa-crespo', hoodName: 'Villa Crespo', phone: '+54 11 5555-1004', visible: false, daysOld: 60 },
  { id: 'u_seed_eva', email: 'eva.seed@hallado.com', name: 'Eva Seed', hood: 'recoleta', hoodName: 'Recoleta', phone: '', visible: false, daysOld: 40 },
];

const U = Object.fromEntries(USERS.map((u) => [u.id.replace('u_seed_', ''), u.id]));
const PHOTO_ID = '5eed0000-0000-4000-8000-000000000001';
// PNG de 1x1 píxel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');

// type: lost|found. Las 'found' llevan pregunta y respuesta de verificación.
const PUBS = [
  { id: 'p_seed_01', cid: '5eed0000-0000-4000-8000-0000000000a1', user: U.ana, type: 'found', title: 'Llaves con llavero de osito', desc: 'Encontré un juego de 3 llaves con un llavero de peluche en la plaza.',
    cat: 'keys', hood: 'palermo', lat: -34.5810, lng: -58.4260, addr: 'Plaza Italia', daysAgo: 3, status: 'open', q: '¿Qué figura tiene el llavero?', a: 'osito' },
  { id: 'p_seed_02', cid: '5eed0000-0000-4000-8000-0000000000a2', user: U.bruno, type: 'lost', title: 'Celular Samsung azul', desc: 'Perdí mi celular con funda azul en el subte línea A.',
    cat: 'electronics', hood: 'caballito', lat: -34.6186, lng: -58.4425, addr: null, daysAgo: 6, status: 'resolved' },
  { id: 'p_seed_03', cid: '5eed0000-0000-4000-8000-0000000000a3', user: U.carla, type: 'found', title: 'DNI encontrado en la calle', desc: 'Documento de identidad hallado cerca de la estación.',
    cat: 'documents', hood: 'belgrano', lat: -34.5627, lng: -58.4583, addr: null, daysAgo: 4, status: 'in_claim', q: '¿En qué año nació el titular?', a: '1990' },
  { id: 'p_seed_04', cid: '5eed0000-0000-4000-8000-0000000000a4', user: U.diego, type: 'lost', title: 'Perro labrador marrón', desc: 'Se escapó mi perro, responde al nombre de Toby. Tiene collar rojo.',
    cat: 'pets', hood: 'villa-crespo', lat: -34.5995, lng: -58.4392, addr: null, daysAgo: 1, status: 'open' },
  { id: 'p_seed_05', cid: '5eed0000-0000-4000-8000-0000000000a5', user: U.eva, type: 'found', title: 'Campera de cuero negra', desc: 'Quedó olvidada en un banco de la plaza.',
    cat: 'clothing', hood: 'recoleta', lat: -34.5875, lng: -58.3974, addr: null, daysAgo: 2, status: 'open', q: '¿Qué hay en el bolsillo interno?', a: 'un pañuelo' },
  { id: 'p_seed_06', cid: '5eed0000-0000-4000-8000-0000000000a6', user: U.eva, type: 'lost', title: 'Bufanda de lana gris', desc: 'Perdida hace más de un mes.',
    cat: 'clothing', hood: 'recoleta', lat: -34.5875, lng: -58.3974, addr: null, daysAgo: 45, status: 'expired', expired: true },
  { id: 'p_seed_07', cid: '5eed0000-0000-4000-8000-0000000000a7', user: U.ana, type: 'lost', title: 'Billetera marrón', desc: 'Con tarjetas y carnet. La perdí en un colectivo.',
    cat: 'other', hood: 'palermo', lat: -34.5790, lng: -58.4298, addr: null, daysAgo: 5, status: 'open' },
];

const sql = {
  user: `INSERT INTO users (id, email, password_hash, name, neighborhood, neighborhood_id, phone, phone_visible_on_claim, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
};

async function main() {
  const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const u of USERS) {
      await client.query(sql.user, [u.id, u.email, hash, u.name, u.hoodName, u.hood, u.phone, u.visible, ago(u.daysOld * DAY)]);
    }

    // Foto de reclamo (obligatoria en un reclamo "found").
    await client.query(
      `INSERT INTO photos (id, user_id, data, mime, kind, created_at) VALUES ($1,$2,$3,'image/png','claim',$4) ON CONFLICT DO NOTHING`,
      [PHOTO_ID, U.carla, PNG, ago(3 * DAY)]
    );

    for (const p of PUBS) {
      const created = ago(p.daysAgo * DAY);
      await client.query(
        `INSERT INTO publications (id, user_id, client_id, type, title, description, category_id, occurred_on, time_from, time_to,
           neighborhood_id, exact_address, latitude, longitude, verification_question, verification_answer,
           status, status_changed_at, expires_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'09:00','12:00',$9,$10,$11,$12,$13,$14,$15,$16,$17,$16)
         ON CONFLICT DO NOTHING`,
        [p.id, p.user, p.cid, p.type, p.title, p.desc, p.cat, day(p.daysAgo), p.hood, p.addr, p.lat, p.lng,
         p.q || null, p.a || null, p.status, created, p.expired ? ago(15 * DAY) : ahead(25 * DAY)]
      );
    }

    // Reclamos: 1 pending (intento 2 de Diego), 1 accepted (Carla en p_seed_02), 1 rejected (intento 1 de Diego).
    const claimSql = `INSERT INTO claims (id, publication_id, publisher_id, publication_type, claimer_id, type, attempt_number,
        verification_answer, description, photo_id, found_neighborhood_id, status, expires_at, decided_at, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT DO NOTHING`;
    await client.query(claimSql, ['c_seed_01', 'p_seed_03', U.carla, 'found', U.diego, 'mine', 1,
      '1985', 'Creo que es el mío', null, null, 'rejected', ago(3 * DAY + 12 * HOUR), ago(4 * DAY), ago(4 * DAY + 20 * HOUR)]);
    await client.query(claimSql, ['c_seed_02', 'p_seed_03', U.carla, 'found', U.diego, 'mine', 2,
      '1990', 'Me equivoqué en el año, es el mío', null, null, 'pending', ahead(46 * HOUR), null, ago(2 * HOUR)]);
    await client.query(claimSql, ['c_seed_03', 'p_seed_02', U.bruno, 'lost', U.carla, 'found', 1,
      null, 'Lo encontré en el andén y tengo foto', PHOTO_ID, 'belgrano', 'accepted', ago(1 * DAY), ago(2 * DAY + 12 * HOUR), ago(3 * DAY + 12 * HOUR)]);

    // Puntos de encuentro del reclamo aceptado: contrapropuesta + aceptado (reemplaza al primero).
    const mpSql = `INSERT INTO meeting_points (id, claim_id, proposed_by, replaces_id, address, latitude, longitude, meet_at, notes, status, responded_at, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`;
    await client.query(mpSql, ['m_seed_01', 'c_seed_03', U.carla, null, 'Estación Belgrano C', -34.5627, -58.4583,
      ago(2 * DAY), 'Frente a la boletería', 'counter_proposed', ago(2 * DAY + 6 * HOUR), ago(2 * DAY + 10 * HOUR)]);
    await client.query(mpSql, ['m_seed_02', 'c_seed_03', U.bruno, 'm_seed_01', 'Estación Primera Junta', -34.6186, -58.4425,
      ago(1 * DAY + 12 * HOUR), 'A las 18, en la entrada principal', 'accepted', ago(2 * DAY), ago(2 * DAY + 4 * HOUR)]);

    // Devolución concretada: Carla devolvió el celular a Bruno (return único por claim_id).
    await client.query(
      `INSERT INTO returns (user_id, created_at, recovered_by_id, claim_id, meeting_point_id)
       VALUES ($1,$2,$3,'c_seed_03','m_seed_02') ON CONFLICT (claim_id) DO NOTHING`,
      [U.carla, ago(1 * DAY), U.bruno]
    );
    const { rows: [ret] } = await client.query(`SELECT id FROM returns WHERE claim_id = 'c_seed_03'`);
    await client.query(
      `INSERT INTO ratings (rated_user_id, author_id, positive, created_at, return_id, comment)
       VALUES ($1,$2,true,$3,$4,'Muy amable y puntual, gracias!') ON CONFLICT (return_id, author_id) DO NOTHING`,
      [U.carla, U.bruno, ago(20 * HOUR), ret.id]
    );
    await client.query(
      `INSERT INTO thanks (return_id, author_id, recipient_id, message, created_at)
       VALUES ($1,$2,$3,'Gracias por devolverme el celular!',$4) ON CONFLICT (return_id) DO NOTHING`,
      [ret.id, U.bruno, U.carla, ago(19 * HOUR)]
    );
    // Insignia ganada por esa primera devolución (misma regla que la migración 003).
    await client.query(
      `INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES ($1,'first_return',$2) ON CONFLICT DO NOTHING`,
      [U.carla, ago(1 * DAY)]
    );

    // Alertas: a_seed_01 coincide con p_seed_01 (nueva desde last_seen_at); a_seed_02 en pausa; a_seed_03 sin coincidencias.
    const alertSql = `INSERT INTO alerts (id, user_id, publication_type, category_id, neighborhood_id, keywords, paused, last_seen_at, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) ON CONFLICT DO NOTHING`;
    await client.query(alertSql, ['a_seed_01', U.bruno, 'found', 'keys', 'palermo', null, false, ago(10 * DAY)]);
    await client.query(alertSql, ['a_seed_02', U.diego, 'found', 'pets', 'villa-crespo', null, true, ago(10 * DAY)]);
    await client.query(alertSql, ['a_seed_03', U.ana, null, null, null, 'billetera', false, ago(10 * DAY)]);

    // Seguidas: Bruno sigue p_seed_01 (visto antes de crearse: novedad); Diego sigue p_seed_05.
    await client.query(`INSERT INTO follows (user_id, publication_id, seen_at, created_at) VALUES ($1,'p_seed_01',$2,$2) ON CONFLICT DO NOTHING`, [U.bruno, ago(5 * DAY)]);
    await client.query(`INSERT INTO follows (user_id, publication_id, seen_at, created_at) VALUES ($1,'p_seed_05',$2,$2) ON CONFLICT DO NOTHING`, [U.diego, ago(1 * HOUR)]);

    // Búsquedas recientes (ids fijos para ser idempotente).
    await client.query(
      `INSERT INTO recent_searches (id, user_id, type, category_id, keywords, neighborhood_id, latitude, longitude, radius_m, date_from, date_to, created_at)
       VALUES ('5eed0000-0000-4000-8000-0000000000b1',$1,'found','keys','llaves','palermo',-34.5790,-58.4298,1500,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [U.bruno, day(30), day(0), ago(2 * HOUR)]
    );
    await client.query(
      `INSERT INTO recent_searches (id, user_id, type, keywords, neighborhood_id, created_at)
       VALUES ('5eed0000-0000-4000-8000-0000000000b2',$1,'lost','perro','villa-crespo',$2) ON CONFLICT DO NOTHING`,
      [U.eva, ago(5 * HOUR)]
    );

    await client.query('COMMIT');
    console.log('Seed demo cargado (idempotente).');
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
