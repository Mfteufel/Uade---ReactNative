// Lanzador único: backend + Expo en la misma terminal, por Wi-Fi/LAN (por defecto) o por USB.
// Uso:
//   node scripts/local/levantar.js                 LAN, base local
//   node scripts/local/levantar.js --usb           USB (adb reverse), base local
//   node scripts/local/levantar.js --neon          base Hallados-dev (backend/.env.demo.neon.local)
// Opciones: --ip=<IP> (o HALLADO_IP), --api-port=<n> (o HALLADO_API_PORT, 3000),
//           --expo-port=<n> (o HALLADO_EXPO_PORT, 8082), --solo-mostrar (no arranca nada),
//           --logs-separados (Expo por pipe con prefijo [expo], sin QR; se usa solo si no hay TTY).
// REGLA: no lee ni depende de backend/.env (en la máquina del equipo apunta a producción).
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { RAIZ, BACKEND, abortar, leerEnv, asegurarEnv, guardaBase, modoCorreo, entornoCorreo, VARS_CORREO } = require('./comun');

// Variables de libpq que pg lee solas: definidas vacías para que un backend/.env no las meta.
const PG_VACIAS = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGOPTIONS', 'PGSERVICE'];
const VIRTUALES = /docker|^br-|veth|vboxnet|vmnet|virbr|wsl|hyper-v|tailscale|^zt|vethernet|loopback/i;

function opcion(nombre) {
  const pref = `--${nombre}=`;
  const a = process.argv.find((x) => x.startsWith(pref));
  return a ? a.slice(pref.length) : undefined;
}

function puerto(valor, nombre, defecto) {
  if (valor === undefined || valor === '') return defecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 65535) abortar(`${nombre} no es un puerto válido: "${valor}".`);
  return n;
}

// Candidatas de IP LAN, ordenadas: 192.168.* > 10.* > 172.16-31.*. Descarta internas y virtuales.
function candidatasIp(interfaces = os.networkInterfaces()) {
  const rango = (ip) => {
    if (ip.startsWith('192.168.')) return 0;
    if (ip.startsWith('10.')) return 1;
    const m = /^172\.(\d+)\./.exec(ip);
    if (m && +m[1] >= 16 && +m[1] <= 31) return 2;
    return null;
  };
  const lista = [];
  for (const [nombre, dirs] of Object.entries(interfaces)) {
    if (VIRTUALES.test(nombre)) continue;
    for (const d of dirs || []) {
      if ((d.family !== 'IPv4' && d.family !== 4) || d.internal) continue;
      const r = rango(d.address);
      if (r !== null) lista.push({ nombre, ip: d.address, r });
    }
  }
  return lista.sort((a, b) => a.r - b.r);
}

function puertoLibre(p) {
  return new Promise((res) => {
    const s = net.createServer();
    s.once('error', () => res(false));
    s.listen(p, '0.0.0.0', () => s.close(() => res(true)));
  });
}

function adbReverse(apiPort, expoPort) {
  const sh = process.platform === 'win32';
  const adb = spawnSync('adb', ['devices'], { encoding: 'utf8', shell: sh });
  if (adb.error || adb.status !== 0) {
    abortar('no se encontró adb (Android platform-tools). Instalalo y agregalo al PATH, o hacé a mano:\n'
      + `  adb reverse tcp:${apiPort} tcp:${apiPort}\n  adb reverse tcp:${expoPort} tcp:${expoPort}`);
  }
  const ok = adb.stdout.split(/\r?\n/).slice(1).some((l) => /\sdevice$/.test(l.trim()));
  if (!ok) {
    abortar('adb no ve ningún dispositivo en estado "device". Conectá el celular por USB, activá la depuración USB, '
      + 'aceptá el cartel de autorización en el celular y verificalo con "adb devices".');
  }
  for (const p of [apiPort, expoPort]) {
    const r = spawnSync('adb', ['reverse', `tcp:${p}`, `tcp:${p}`], { encoding: 'utf8', shell: sh });
    if (r.status !== 0) abortar(`falló "adb reverse tcp:${p} tcp:${p}": ${(r.stderr || r.stdout || '').trim()}`);
  }
  console.log(`adb reverse listo (puertos ${apiPort} y ${expoPort}).`);
}

// Comando de Expo: el CLI local con el node actual (sin npx de intermediario); si no está, npx.
function comandoExpo(args) {
  try {
    return { cmd: process.execPath, args: [require.resolve('expo/bin/cli', { paths: [RAIZ] }), ...args], shell: false };
  } catch {
    return { cmd: 'npx', args: ['expo', ...args], shell: process.platform === 'win32' };
  }
}

function prefijar(stream, etiqueta, destino) {
  let resto = '';
  stream.on('data', (b) => {
    const partes = (resto + b.toString()).split(/\r?\n/);
    resto = partes.pop();
    for (const l of partes) destino.write(`[${etiqueta}] ${l}\n`);
  });
  stream.on('end', () => { if (resto) destino.write(`[${etiqueta}] ${resto}\n`); });
}

async function main() {
  const usb = process.argv.includes('--usb');
  const neon = process.argv.includes('--neon');
  const soloMostrar = process.argv.includes('--solo-mostrar');
  // Expo directo (stdio heredado: QR y atajos) solo con TTY real y sin --logs-separados.
  const expoDirecto = !process.argv.includes('--logs-separados') && Boolean(process.stdout.isTTY && process.stdin.isTTY);
  const apiPort = puerto(opcion('api-port') ?? process.env.HALLADO_API_PORT, 'api-port', 3000);
  const expoPort = puerto(opcion('expo-port') ?? process.env.HALLADO_EXPO_PORT, 'expo-port', 8082);

  const archivo = asegurarEnv({ neon });
  const envArchivo = leerEnv(archivo);
  const baseHost = await guardaBase(envArchivo.DATABASE_URL, { neon, nombre: 'DATABASE_URL' });

  // Host por el que el celular llega a la PC.
  let host = 'localhost';
  if (!usb) {
    const forzada = opcion('ip') || process.env.HALLADO_IP;
    if (forzada) {
      if (!net.isIPv4(forzada)) abortar(`la IP forzada "${forzada}" no es una IPv4 válida.`);
      host = forzada;
    } else {
      const c = candidatasIp();
      if (!c.length) abortar('no se detectó una IP de red local. Conectate a la red Wi-Fi/LAN, usá --usb, o forzala con --ip=<IP>.');
      if (c.length > 1) {
        console.log('Se detectaron varias IP de red local (se usa la primera; para otra, --ip=<IP>):');
        for (const x of c) console.log(`  ${x.ip}  (${x.nombre})`);
      }
      host = c[0].ip;
    }
  }

  const apiUrl = `http://${host}:${apiPort}`;
  const entornoBackend = {
    ...process.env,
    ...Object.fromEntries(PG_VACIAS.map((k) => [k, ''])),
    ...envArchivo,
    ...entornoCorreo(envArchivo, { neon }),
    PORT: String(apiPort),
    PUBLIC_URL: apiUrl,
  };
  const argsBackend = [`--env-file=${archivo}`, 'src/index.js'];
  const argsExpo = ['start', usb ? '--localhost' : '--lan', '--port', String(expoPort), '-c'];
  const expo = comandoExpo(argsExpo);
  const entornoExpo = {
    ...process.env,
    EXPO_PUBLIC_USE_MOCK: 'false',
    EXPO_PUBLIC_API_URL: apiUrl,
    REACT_NATIVE_PACKAGER_HOSTNAME: host,
  };
  const expUrl = `exp://${host}:${expoPort}`;
  const correo = modoCorreo(entornoBackend);

  console.log('\n=== Hallado: backend + Expo ===');
  console.log(`Conexión : ${usb ? 'USB (adb reverse, localhost)' : `Wi-Fi/LAN (IP ${host})`}`);
  console.log(`API      : ${apiUrl}`);
  console.log(`Expo Go  : ${expUrl}  (si el QR no conecta, abrila a mano en Expo Go)`);
  console.log(expoDirecto
    ? 'QR      : lo imprime Expo más abajo en esta terminal (atajos: r recarga, a Android, ? ayuda; Ctrl+C corta todo). Logs de la API con prefijo [api].'
    : 'QR      : no se muestra (Expo va por pipe con prefijo [expo]; sin TTY o con --logs-separados). Usá la URL exp:// de arriba.');
  console.log(`Base     : ${neon ? `Neon: ${baseHost}` : `local (${baseHost})`}`);
  console.log(`Correo   : ${correo}`);
  if (correo === 'consola') {
    console.log('           Los códigos OTP salen en las líneas "[api] [MAIL DEV]" de esta terminal.');
    console.log('           Para que lleguen por mail, completá las variables de correo en backend/.env.demo.local.');
  }
  console.log(`PUBLIC_URL del backend: ${apiUrl}`);
  console.log(`Backend  : node ${argsBackend.map((a) => (a.startsWith('--env-file=') ? `--env-file=${path.basename(archivo)}` : a)).join(' ')}  (en backend/)`);
  console.log(`Expo     : ${expo.cmd === process.execPath ? 'node expo/bin/cli' : 'npx expo'} ${argsExpo.join(' ')}`);
  console.log(`Expo env : EXPO_PUBLIC_USE_MOCK=false EXPO_PUBLIC_API_URL=${apiUrl} REACT_NATIVE_PACKAGER_HOSTNAME=${host}`);
  if (soloMostrar) {
    if (process.env.HALLADO_VOLCAR_ENTORNO === '1') {
      // Solo para pruebas: estado de las variables de correo del hijo (sin valores).
      for (const k of VARS_CORREO) console.log(`ENTORNO ${k}: ${k in entornoBackend ? (entornoBackend[k] === '' ? 'definida-vacia' : 'definida-con-valor') : 'NO definida'}`);
    }
    if (usb) console.log(`(USB) correría: adb reverse tcp:${apiPort} tcp:${apiPort} y tcp:${expoPort} tcp:${expoPort}`);
    console.log('--solo-mostrar: no se arrancó nada.');
    return;
  }

  if (usb) adbReverse(apiPort, expoPort);
  for (const [p, quien] of [[apiPort, 'la API'], [expoPort, 'Expo']]) {
    if (!(await puertoLibre(p))) abortar(`el puerto ${p} (${quien}) ya está en uso. Cerrá el proceso que lo usa o elegí otro con --api-port / --expo-port.`);
  }
  console.log(`\nSi el celular no conecta, revisá el firewall de la PC (puertos TCP ${apiPort} y ${expoPort}), que PC y celular estén en la misma red`
    + ' (sin aislamiento de clientes) o probá con --usb.\n');

  let terminando = false;
  const hijos = [];

  function matar(p, senal) {
    if (p.exitCode !== null || p.signalCode !== null) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F']);
    else { try { p.kill(senal); } catch { /* ya muerto */ } }
  }

  function cortar(codigo) {
    if (terminando) return;
    terminando = true;
    console.log('\nCortando backend y Expo...');
    for (const { p } of hijos) matar(p, 'SIGTERM');
    const t = setTimeout(() => { for (const { p } of hijos) matar(p, 'SIGKILL'); process.exit(codigo); }, 5000);
    Promise.all(hijos.map(({ p }) => new Promise((r) => {
      if (p.exitCode !== null || p.signalCode !== null) r(); else p.once('exit', r);
    }))).then(() => { clearTimeout(t); process.exit(codigo); });
  }

  const lanzar = (etiqueta, cmd, args, opts, directo) => {
    const p = spawn(cmd, args, { ...opts, stdio: directo ? 'inherit' : [etiqueta === 'expo' ? 'inherit' : 'ignore', 'pipe', 'pipe'] });
    hijos.push({ etiqueta, p });
    if (!directo) {
      prefijar(p.stdout, etiqueta, process.stdout);
      prefijar(p.stderr, etiqueta, process.stderr);
    }
    p.on('error', (e) => { console.error(`[${etiqueta}] no se pudo iniciar: ${e.message}`); cortar(1); });
    p.on('exit', (code, sig) => {
      // Con stdio heredado Ctrl+C llega a todo el grupo: se espera un instante a que el SIGINT del lanzador marque el cierre.
      setTimeout(() => {
        if (terminando) return;
        if (directo && (code === 0 || sig === 'SIGINT')) return cortar(0);
        console.error(`[${etiqueta}] terminó (${sig || `código ${code}`}); se corta el otro proceso.`);
        if (etiqueta === 'api') console.error('Si es un error de base: en modo local revisá que tu Postgres esté corriendo y que DATABASE_URL de backend/.env.demo.local sea correcta, y corré "npm run db:preparar"; en modo Neon revisá backend/.env.demo.neon.local.');
        cortar(code || 1);
      }, 200);
    });
  };

  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => cortar(0));

  lanzar('api', process.execPath, argsBackend, { cwd: BACKEND, env: entornoBackend }, false);
  lanzar('expo', expo.cmd, expo.args, { cwd: RAIZ, env: entornoExpo, shell: expo.shell }, expoDirecto);
}

if (require.main === module) main().catch((e) => abortar(e.message));
module.exports = { candidatasIp };
