// Inicia LabTrace en local con un solo comando:
//   instala dependencias (si faltan) -> compila (si hay cambios) -> levanta el servidor -> abre el navegador.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = join(ROOT, 'backend');
const FRONTEND = join(ROOT, 'frontend');
const PORT = Number(process.env.PORT) || 3000;
const URL = `http://localhost:${PORT}`;
const PRESENCE_URL = `http://127.0.0.1:${PORT}/api/runtime/active-clients`;
const HEARTBEAT_INTERVAL_MS = 3000;
const EMPTY_WINDOW_MS = 15_000;
const STARTUP_WINDOW_MS = 120_000;

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const run = (cmd, args) => {
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (res.status !== 0) fail(`Falló: ${cmd} ${args.join(' ')}`);
};

// Fecha de modificación más reciente de un archivo o carpeta
const newest = (path) => {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return readdirSync(path).reduce((max, name) => Math.max(max, newest(join(path, name))), 0);
};
const isStale = (sources, output) =>
  !existsSync(output) || Math.max(...sources.map(newest)) > statSync(output).mtimeMs;

// ¿Ya hay un LabTrace respondiendo en el puerto?
async function isUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1500) });
    return res.ok && (await res.text()).includes('LabTrace');
  } catch {
    return false;
  }
}

async function getActiveClients() {
  const response = await fetch(PRESENCE_URL, { signal: AbortSignal.timeout(1500) });
  if (!response.ok) throw new Error(`Presence endpoint returned ${response.status}`);
  const result = await response.json();
  if (!Number.isInteger(result.count) || result.count < 0) {
    throw new Error('Presence endpoint returned an invalid client count');
  }
  return result.count;
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  child.on('error', () => console.log(`Abre manualmente: ${url}`)); // sin navegador/opener disponible
  child.unref();
}

async function main() {
  if (await isUp()) {
    console.log(`LabTrace ya está en ejecución en ${URL}`);
    return openBrowser(URL);
  }

  if (!existsSync(join(BACKEND, '.env'))) {
    fail('Falta backend/.env. Copia backend/.env.example a backend/.env y completa las credenciales de Supabase.');
  }

  if (!existsSync(join(ROOT, 'node_modules'))) {
    console.log('▶ Instalando dependencias (solo la primera vez)…');
    run('npm', ['install']);
  }

  // Si schema.prisma es más nuevo que el cliente generado (p. ej. se agregó una columna), hay que regenerarlo;
  // de lo contrario el backend no compila o falla con "Unknown field".
  if (isStale([join(BACKEND, 'prisma', 'schema.prisma')], join(ROOT, 'node_modules', '.prisma', 'client', 'index.js'))) {
    console.log('▶ Actualizando el cliente de base de datos…');
    run('npm', ['run', 'postinstall', '-w', 'backend']);
  }

  const backendOut = join(BACKEND, 'dist', 'main.js');
  const frontendOut = join(FRONTEND, 'dist', 'index.html');

  if (isStale([join(BACKEND, 'src'), join(BACKEND, 'prisma')], backendOut)) {
    console.log('▶ Compilando backend…');
    run('npm', ['run', 'build', '-w', 'backend']);
  }
  if (isStale([join(FRONTEND, 'src'), join(FRONTEND, 'index.html')], frontendOut)) {
    console.log('▶ Compilando frontend…');
    run('npm', ['run', 'build', '-w', 'frontend']);
  }

  console.log('▶ Iniciando servidor…');
  const server = spawn(process.execPath, [backendOut], {
    cwd: BACKEND,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
  });
  let stopping = false;
  const stopServer = () => {
    if (!stopping && server.exitCode === null && !server.killed) {
      stopping = true;
      server.kill();
    }
  };
  server.on('exit', (code) => {
    process.removeListener('exit', stopServer);
    process.exit(code ?? 0);
  });
  process.on('exit', stopServer);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stopServer);
  if (process.platform === 'win32') process.on('SIGBREAK', stopServer);

  const deadline = Date.now() + 60_000;
  let serverReady = false;
  while (Date.now() < deadline) {
    if (await isUp()) {
      console.log(`\n✔ LabTrace lista en ${URL}. Se cerrará cuando cierres la última pestaña.\n`);
      if (process.env.LABTRACE_NO_BROWSER === '1') {
        console.log(`Abre manualmente: ${URL}`);
      } else {
        openBrowser(URL);
      }
      serverReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!serverReady) {
    server.kill();
    fail('El servidor no respondió en 60 s. Revisa los mensajes de arriba (¿credenciales de la base de datos?).');
  }

  let sawActiveClient = false;
  let emptySince = null;
  const startupDeadline = Date.now() + STARTUP_WINDOW_MS;
  while (server.exitCode === null) {
    try {
      const activeClients = await getActiveClients();
      if (activeClients > 0) {
        sawActiveClient = true;
        emptySince = null;
      } else if (sawActiveClient) {
        emptySince ??= Date.now();
        if (Date.now() - emptySince >= EMPTY_WINDOW_MS) {
          console.log('No hay pestañas de LabTrace abiertas. Cerrando el servidor local…');
          stopServer();
          break;
        }
      } else if (Date.now() >= startupDeadline) {
        console.log('No se detectó ninguna pestaña de LabTrace. Cerrando el servidor local…');
        stopServer();
        break;
      }
    } catch {
      // Un error transitorio no debe cerrar un servidor que todavía podría tener usuarios conectados.
    }
    await new Promise((resolve) => setTimeout(resolve, HEARTBEAT_INTERVAL_MS));
  }
}

main();
