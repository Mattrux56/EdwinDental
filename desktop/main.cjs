// Proceso principal de LabTrace de escritorio:
//   lee las claves de Supabase -> levanta el servidor (backend/dist/main.js) en un puerto libre -> muestra la interfaz en una ventana.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, utilityProcess } = require('electron');
const { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
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

// Puerto fijo: la interfaz queda siempre en el mismo origen, así el navegador conserva lo que recuerda
// (p. ej. la cámara elegida). Si está ocupado se usa uno libre cualquiera.
const PUERTO_PREFERIDO = 47318;

const puertoLibre = (preferido = 0) =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', (error) => (preferido ? puertoLibre().then(resolve, reject) : reject(error)));
    probe.listen(preferido, '127.0.0.1', () => {
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
  const port = await puertoLibre(PUERTO_PREFERIDO);
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, 'preload-app.cjs'),
    },
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
  // La app no tiene menú (así Alt no muestra nada); estas teclas hacen lo que hacía el menú «Ver»
  mainWin.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const contents = mainWin.webContents;
    const ctrl = input.control || input.meta;
    if (input.key === 'F5' || (ctrl && input.key.toLowerCase() === 'r')) contents.reload();
    else if (ctrl && (input.key === '+' || input.key === '=')) contents.setZoomLevel(contents.getZoomLevel() + 0.5);
    else if (ctrl && input.key === '-') contents.setZoomLevel(contents.getZoomLevel() - 0.5);
    else if (ctrl && input.key === '0') contents.setZoomLevel(0);
    else if (input.key === 'F11') mainWin.setFullScreen(!mainWin.isFullScreen());
    else return;
    event.preventDefault();
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

/** Documento (HTML en la carpeta temporal) que imprime cada ventana de vista previa, por id de su webContents */
const documentosEnVista = new Map();

/** Barra con el botón de imprimir y el PDF debajo, sin la barra del visor (su botón no deja elegir el papel) */
const paginaVista = (titulo) => `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<title>${titulo.replace(/[<&]/g, '')}</title>
<style>
  html, body { margin: 0; height: 100%; background: #525659; font-family: 'Segoe UI', Arial, sans-serif; }
  body { display: flex; flex-direction: column; }
  header { display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: #323639; color: #f1f1f1; font-size: 14px; }
  header span { flex: 1; }
  button { padding: 7px 22px; border: 0; border-radius: 6px; background: #1a73e8; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  embed { flex: 1; width: 100%; border: 0; }
</style></head><body>
<header><span>Papel carta</span><button id="imprimir" type="button">Imprimir</button></header>
<embed src="documento.pdf#toolbar=0&navpanes=0" type="application/pdf" />
<script>
  const boton = document.getElementById('imprimir');
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    try {
      const resultado = await window.labtraceVista.imprimir();
      if (!resultado.ok) alert(resultado.message);
    } finally {
      boton.disabled = false;
    }
  });
</script></body></html>`;

/**
 * Vista previa de impresión: el diálogo de Windows no muestra la hoja (Electron no le entrega la vista previa),
 * así que el documento se convierte en PDF y se muestra en una ventana con su propio botón de imprimir,
 * que abre el diálogo de Windows con el papel carta ya elegido.
 */
async function abrirVistaImpresion(html, titulo) {
  const carpeta = mkdtempSync(join(tmpdir(), 'labtrace-impresion-'));
  const htmlFile = join(carpeta, 'documento.html');
  const pdfFile = join(carpeta, 'documento.pdf');
  writeFileSync(htmlFile, html, 'utf8');

  const oculta = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await oculta.loadFile(htmlFile);
    // El tamaño de hoja y los márgenes los pone el propio documento (@page y relleno del body)
    const pdf = await oculta.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    writeFileSync(pdfFile, pdf);
  } finally {
    oculta.destroy();
  }

  const vista = new BrowserWindow({
    width: 1000,
    height: 860,
    parent: mainWin ?? undefined,
    icon: ICON,
    title: `Vista previa · ${titulo}`,
    backgroundColor: '#525659',
    webPreferences: {
      sandbox: true,
      plugins: true, // el visor de PDF de Chromium
      preload: join(__dirname, 'preload-vista.cjs'),
    },
  });
  const vistaId = vista.webContents.id;
  documentosEnVista.set(vistaId, htmlFile);
  vista.on('page-title-updated', (event) => event.preventDefault()); // conserva el título de la ventana
  vista.on('closed', () => {
    documentosEnVista.delete(vistaId);
    try {
      rmSync(carpeta, { recursive: true, force: true });
    } catch {
      // si Windows aún tiene el archivo abierto, queda en la carpeta temporal
    }
  });
  const vistaFile = join(carpeta, 'vista.html');
  writeFileSync(vistaFile, paginaVista(titulo), 'utf8');
  await vista.loadFile(vistaFile);
}

/** Abre el diálogo de impresión de Windows con el documento en papel carta vertical y sin márgenes de la impresora */
async function imprimirEnCarta(htmlFile) {
  const oculta = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await oculta.loadFile(htmlFile);
    return await new Promise((resolve) => {
      oculta.webContents.print(
        {
          silent: false,
          pageSize: 'Letter',
          landscape: false,
          margins: { marginType: 'none' }, // los márgenes los pone el propio documento
          printBackground: true,
        },
        (ok, motivo) => resolve(ok || motivo === 'Print job canceled'
          ? { ok: true }
          : { ok: false, message: `No se pudo imprimir: ${motivo}` }),
      );
    });
  } finally {
    oculta.destroy();
  }
}

ipcMain.handle('impresion:imprimir', async (event) => {
  const htmlFile = documentosEnVista.get(event.sender.id);
  if (!htmlFile) return { ok: false, message: 'Origen no permitido.' };
  try {
    return await imprimirEnCarta(htmlFile);
  } catch (error) {
    return { ok: false, message: `No se pudo imprimir: ${error.message}` };
  }
});

// Sin vista previa (la nota): directo al diálogo de Windows en papel carta
ipcMain.handle('impresion:directa', async (event, datos) => {
  if (!mainWin || event.sender !== mainWin.webContents) return { ok: false, message: 'Origen no permitido.' };
  const html = String(datos?.html ?? '');
  if (!html) return { ok: false, message: 'No hay nada que imprimir.' };
  const carpeta = mkdtempSync(join(tmpdir(), 'labtrace-impresion-'));
  try {
    const htmlFile = join(carpeta, 'documento.html');
    writeFileSync(htmlFile, html, 'utf8');
    return await imprimirEnCarta(htmlFile);
  } catch (error) {
    return { ok: false, message: `No se pudo imprimir: ${error.message}` };
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
  }
});

ipcMain.handle('impresion:vista', async (event, datos) => {
  if (!mainWin || event.sender !== mainWin.webContents) return { ok: false, message: 'Origen no permitido.' };
  const html = String(datos?.html ?? '');
  const titulo = String(datos?.titulo ?? 'Documento').slice(0, 120);
  if (!html) return { ok: false, message: 'No hay nada que imprimir.' };
  try {
    await abrirVistaImpresion(html, titulo);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: `No se pudo abrir la vista previa: ${error.message}` };
  }
});
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
    Menu.setApplicationMenu(null);
    iniciar();
  });
}
