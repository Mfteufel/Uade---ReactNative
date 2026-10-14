const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { Pool } = require('pg');

// La cadena de Neon ya trae sslmode=require, no hace falta configurar ssl aparte.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
