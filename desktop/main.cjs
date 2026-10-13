// Proceso principal de LabTrace de escritorio:
//   lee las claves de Supabase -> levanta el servidor (backend/dist/main.js) en un puerto libre -> muestra la interfaz en una ventana.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, utilityProcess } = require('electron');
const { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { createServer } = require('node:net');
const { dirname, join } = require('node:path');
const { buscarActualizacion } = require('./updater.cjs');

// Instalada: <app>/electron/main.cjs · En desarrollo: <repo>/desktop/main.cjs. En ambos casos el backend queda en ../backend
const ROOT = join(__dirname, '..');
const SERVER_ENTRY = join(ROOT, 'backend', 'dist', 'main.js');
const ICON = join(__dirname, 'LabTrace.ico');
const CLAVES = ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];

app.setName('LabTrace');
// Las claves viven fuera de la carpeta de instalación para que sobrevivan a las actualizaciones
const ENV_FILE = process.env.LABTRACE_ENV_FILE
  || (app.isPackaged ? join(app.getPath('userData'), '.env') : join(ROOT, 'backend', '.env'));
const LOG_FILE = join(app.getPath('userData'), 'logs', 'labtrace.log');

let mainWin = null;
let setupWin = null;
let server = null;
let busy = false; // evita cerrar la app mientras se pasa de una ventana a otra
let ultimasLineas = [];

/** Valores actuales del archivo de claves (cadenas vacías si falta alguno) */
function leerClaves(file = ENV_FILE) {
  const valores = Object.fromEntries(CLAVES.map((clave) => [clave, '']));
  if (!existsSync(file)) return valores;
  for (const linea of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match && CLAVES.includes(match[1])) valores[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  return valores;
}

function guardarClaves(valores) {
  mkdirSync(dirname(ENV_FILE), { recursive: true });
  writeFileSync(ENV_FILE, `${CLAVES.map((clave) => `${clave}="${valores[clave]}"`).join('\n')}\n`, 'utf8');
}

const puertoLibre = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function detenerServidor() {
  const child = server;
  server = null;
  if (!child) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

/** Levanta el servidor y devuelve su puerto cuando ya responde */
async function iniciarServidor() {
  if (!existsSync(SERVER_ENTRY)) throw new Error(`No se encontró el servidor en ${SERVER_ENTRY}.`);
  const port = await puertoLibre();
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  const log = createWriteStream(LOG_FILE, { flags: 'w' });
  ultimasLineas = [];
  log.write(`LabTrace ${app.getVersion()} · servidor en http://127.0.0.1:${port} · claves en ${ENV_FILE}\n`);

  const child = utilityProcess.fork(SERVER_ENTRY, [], {
    cwd: join(ROOT, 'backend'),
    stdio: 'pipe',
    serviceName: 'LabTrace servidor',
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production', LABTRACE_ENV_FILE: ENV_FILE },
  });
  server = child;
  let salio = false;
  const registrar = (chunk) => {
    log.write(chunk);
    ultimasLineas = [...ultimasLineas, ...String(chunk).split(/\r?\n/).filter(Boolean)].slice(-12);
  };
  child.stdout?.on('data', registrar);
  child.stderr?.on('data', registrar);
  child.once('exit', () => {
    salio = true;
    log.end();
    if (server === child) server = null;
  });

  const limite = Date.now() + 60_000;
  while (Date.now() < limite && !salio) {
    try {
      await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) });
      return port;
    } catch {
      await esperar(300);
    }
  }
  throw new Error(
    `El servidor no pudo iniciar.\n\n${ultimasLineas.join('\n') || 'Sin mensajes.'}\n\nRegistro completo: ${LOG_FILE}`,
  );
}

/** ¿La base de datos responde con las claves guardadas? */
async function baseResponde(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/cases/stats`, { signal: AbortSignal.timeout(20_000) });
    return res.ok;
  } catch {
    return false;
  }
}

function abrirPrincipal(port) {
  const url = `http://127.0.0.1:${port}/`;
  if (mainWin) {
    mainWin.loadURL(url);
    mainWin.focus();
    return;
  }
  mainWin = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: ICON,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true, // el menú (Archivo, Ver) queda oculto; aparece al pulsar Alt
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWin.once('ready-to-show', () => {
    mainWin.maximize();
    mainWin.show();
  });
  // Lo que no sea la propia app se abre en el navegador del equipo
  mainWin.webContents.setWindowOpenHandler(({ url: destino }) => {
    if (/^https?:/i.test(destino)) shell.openExternal(destino);
    return { action: 'deny' };
  });
  mainWin.webContents.on('will-navigate', (event, destino) => {
    if (!destino.startsWith(new URL(mainWin.webContents.getURL()).origin)) {
      event.preventDefault();
      if (/^https?:/i.test(destino)) shell.openExternal(destino);
    }
  });
  mainWin.on('closed', () => {
    mainWin = null;
  });
  mainWin.loadURL(url);
}

function abrirConfiguracion() {
  if (setupWin) return setupWin.focus();
  setupWin = new BrowserWindow({
    width: 720,
    height: 640,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWin ?? undefined,
    modal: Boolean(mainWin),
    icon: ICON,
    title: 'LabTrace · Configurar conexión',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, 'preload.cjs'),
    },
  });
  setupWin.setMenuBarVisibility(false);
  setupWin.on('closed', () => {
    setupWin = null;
  });
  setupWin.loadFile(join(__dirname, 'setup.html'));
}

/** Reinicia el servidor con las claves guardadas y muestra la app. Devuelve { ok, message } */
async function lanzar() {
  busy = true;
  try {
    await detenerServidor();
    const port = await iniciarServidor();
    if (!(await baseResponde(port))) {
      throw new Error(
        'La base de datos no respondió. Revisa las claves de Supabase y la conexión a internet '
          + '(un proyecto gratuito de Supabase se pausa tras una semana sin uso y se reactiva desde su panel).',
      );
    }
    abrirPrincipal(port);
    setupWin?.close();
    buscarActualizacion(() => mainWin);
    return { ok: true };
  } catch (error) {
    await detenerServidor();
    return { ok: false, message: error.message };
  } finally {
    busy = false;
  }
}

async function iniciar() {
  if (!existsSync(ENV_FILE)) return abrirConfiguracion();
  for (;;) {
    const resultado = await lanzar();
    if (resultado.ok) return;
    const { response } = await dialog.showMessageBox({
      type: 'error',
      title: 'LabTrace',
      message: 'No se pudo abrir LabTrace',
      detail: resultado.message,
      buttons: ['Reintentar', 'Revisar claves', 'Salir'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (response === 1) return abrirConfiguracion();
    if (response === 2) return app.quit();
  }
}

function crearMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        { label: 'Configurar conexión…', click: abrirConfiguracion },
        { label: 'Abrir carpeta de registros', click: () => shell.openPath(dirname(LOG_FILE)) },
        { type: 'separator' },
        { label: 'Salir', role: 'quit' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Recargar', role: 'reload' },
        { type: 'separator' },
        { label: 'Acercar', role: 'zoomIn' },
        { label: 'Alejar', role: 'zoomOut' },
        { label: 'Tamaño normal', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Pantalla completa', role: 'togglefullscreen' },
      ],
    },
  ]));
}

ipcMain.handle('config:leer', () => leerClaves());
ipcMain.handle('config:importar', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(setupWin, {
    title: 'Elegir el archivo .env de LabTrace',
    properties: ['openFile', 'showHiddenFiles'],
    filters: [{ name: 'Todos los archivos', extensions: ['*'] }],
  });
  return canceled ? null : leerClaves(filePaths[0]);
});
ipcMain.handle('config:guardar', async (_event, valores) => {
  const limpios = {};
  for (const clave of CLAVES) {
    const valor = String(valores?.[clave] ?? '').trim().replace(/^(["'])(.*)\1$/, '$2');
    if (!valor || /[\r\n"]/.test(valor)) return { ok: false, message: `Revisa el valor de ${clave}.` };
    limpios[clave] = valor;
  }
  guardarClaves(limpios);
  return lanzar();
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = setupWin ?? mainWin;
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.on('window-all-closed', () => {
    if (!busy) app.quit();
  });
  app.on('will-quit', () => {
    server?.kill();
  });
  app.whenReady().then(() => {
    crearMenu();
    iniciar();
  });
}
