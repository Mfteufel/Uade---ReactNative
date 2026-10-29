// Helpers comunes de los scripts de ejecución local (solo Node, sin dependencias).
// REGLA: nada de acá lee ni depende de backend/.env (en la máquina del equipo apunta a producción).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawn } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const BACKEND = path.join(RAIZ, 'backend');
const PLANTILLA = path.join(BACKEND, '.env.local-demo.example');
const ENV_LOCAL = path.join(BACKEND, '.env.demo.local');
const ENV_NEON = path.join(BACKEND, '.env.demo.neon.local');
const HOSTS_LOCALES = ['localhost', '127.0.0.1'];
const HOST_PRODUCCION = 'ep-super-forest'; // cualquier host que lo contenga (incluido el pooler) es producción

function abortar(msg) {
  console.error(`ABORTADO: ${msg}`);
  process.exit(1);
}

// Parsea un archivo KEY=VALUE (comentarios con #, comillas opcionales). Conserva las claves vacías.
function leerEnv(archivo) {
  const env = {};
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(linea);
    if (!m) continue;
    let v = m[2].trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

// Local: crea backend/.env.demo.local desde la plantilla y completa JWT_SECRET si falta.
// Neon: no crea nada; si falta el archivo, explica cómo conseguirlo. Nunca imprime valores.
function asegurarEnv({ neon = false } = {}) {
  if (neon) {
    if (!fs.existsSync(ENV_NEON)) {
      abortar('falta backend/.env.demo.neon.local. Pedíselo en privado a los autores y ponelo en backend/.');
    }
    return ENV_NEON;
  }
  if (!fs.existsSync(ENV_LOCAL)) {
    fs.copyFileSync(PLANTILLA, ENV_LOCAL);
    fs.chmodSync(ENV_LOCAL, 0o600);
    console.log('Se creó backend/.env.demo.local desde la plantilla.');
  }
  if (!leerEnv(ENV_LOCAL).JWT_SECRET) {
    const secreto = crypto.randomBytes(48).toString('base64url');
    const texto = fs.readFileSync(ENV_LOCAL, 'utf8');
    const nuevo = /^\s*JWT_SECRET\s*=.*$/m.test(texto)
      ? texto.replace(/^\s*JWT_SECRET\s*=.*$/m, () => `JWT_SECRET=${secreto}`)
      : `${texto.replace(/\n?$/, '\n')}JWT_SECRET=${secreto}\n`;
    fs.writeFileSync(ENV_LOCAL, nuevo);
    console.log('Se generó JWT_SECRET en backend/.env.demo.local.');
  }
  return ENV_LOCAL;
}

// Devuelve el hostname de una URL de base (sin credenciales) o aborta si no es válida.
function hostDe(url, nombre) {
  if (!url) abortar(`falta ${nombre} en el archivo de entorno.`);
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    abortar(`${nombre} no es una URL válida.`);
  }
}

function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(texto, (r) => { rl.close(); res(r.trim()); }));
}

// Guarda de base. Local: solo localhost/127.0.0.1. Neon: bloquea producción y confirma el host por TTY.
// Siempre se bloquea ep-super-forest, antes de conectarse. Devuelve el hostname.
async function guardaBase(url, { neon = false, nombre = 'DATABASE_URL' } = {}) {
  const host = hostDe(url, nombre);
  if (host.includes(HOST_PRODUCCION)) abortar(`${nombre} apunta a producción (${HOST_PRODUCCION}); no se toca.`);
  if (!neon) {
    if (!HOSTS_LOCALES.includes(host)) {
      abortar(`${nombre} tiene el host "${host}" y en modo local solo se permite localhost o 127.0.0.1.`);
    }
    return host;
  }
  if (!process.stdin.isTTY) abortar('el modo Neon pide confirmación y la terminal no es interactiva.');
  console.log(`Base de destino (modo Neon): ${host}`);
  if ((await preguntar('Escribí "si" para continuar: ')).toLowerCase() !== 'si') abortar('no se confirmó el host.');
  return host;
}

// Variables de correo que lee backend/src/config.js. Siempre se definen (vacías por defecto).
const VARS_CORREO = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'BREVO_API_KEY', 'MAIL_FROM'];

// Arma las variables de correo del backend. Todas definidas (vacías por defecto). Fuente: .env.demo.local
// si existe; en modo Neon, las no vacías del propio archivo de Neon tienen prioridad. Nunca imprime valores.
function entornoCorreo(envArchivo, { neon = false } = {}) {
  const out = Object.fromEntries(VARS_CORREO.map((k) => [k, '']));
  const aplicar = (env) => {
    for (const k of VARS_CORREO) if (typeof env[k] === 'string' && env[k].trim() !== '') out[k] = env[k];
  };
  if (fs.existsSync(ENV_LOCAL)) aplicar(leerEnv(ENV_LOCAL));
  if (neon) aplicar(envArchivo);
  return out;
}

// Cómo se mandan los códigos OTP, según el entorno FINAL del backend (sin mostrar valores).
// Misma prioridad que backend/src/config.js: smtp > brevo > consola.
function modoCorreo(env) {
  const t = (v) => (typeof v === 'string' ? v.trim() : '');
  if (t(env.SMTP_USER) && t(env.SMTP_PASS)) return 'mail (SMTP)';
  if (t(env.BREVO_API_KEY) && t(env.MAIL_FROM)) return 'mail (Brevo)';
  return 'consola';
}

// Corre un comando heredando la salida; devuelve el código de salida. shell solo en Windows (npx).
function correr(cmd, args, { cwd = RAIZ, env = process.env } = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('error', rej);
    p.on('close', (code) => res(code ?? 1));
  });
}

module.exports = {
  RAIZ, BACKEND, ENV_LOCAL, ENV_NEON, HOST_PRODUCCION,
  abortar, leerEnv, asegurarEnv, guardaBase, modoCorreo, entornoCorreo, VARS_CORREO, correr, preguntar,
};
