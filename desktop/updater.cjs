// Actualización automática: al iniciar busca una versión más nueva en los Releases de GitHub
// y pregunta si se instala ahora o en otro momento.
const { app, BrowserWindow, dialog } = require('electron');
const { appendFileSync, mkdirSync } = require('node:fs');
const { dirname, join } = require('node:path');

let revisado = false; // una sola vez por sesión

function registrar(mensaje) {
  try {
    const file = join(app.getPath('userData'), 'logs', 'actualizacion.log');
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${new Date().toISOString()} ${mensaje}\n`);
  } catch {
    /* el registro nunca debe impedir que la app funcione */
  }
}

function abrirProgreso(parent, version) {
  const win = new BrowserWindow({
    width: 420,
    height: 170,
    parent: parent ?? undefined,
    modal: Boolean(parent),
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    title: 'Actualizando LabTrace',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(join(__dirname, 'update.html'), { query: { version } });
  return win;
}

/** `getWin` devuelve la ventana principal vigente (puede haberse cerrado mientras se consultaba) */
function buscarActualizacion(getWin) {
  if (revisado || !app.isPackaged) return;
  revisado = true;

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (error) {
    return registrar(`No se pudo cargar el actualizador: ${error.message}`);
  }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  let progreso = null;
  const ventana = () => {
    const win = getWin();
    return win && !win.isDestroyed() && win.isVisible() ? win : undefined;
  };
  const cerrarProgreso = () => {
    if (progreso && !progreso.isDestroyed()) progreso.destroy();
    progreso = null;
    ventana()?.setProgressBar(-1);
  };

  autoUpdater.on('error', (error) => {
    registrar(`Error: ${error?.message ?? error}`);
    if (!progreso) return; // fallo al consultar (p. ej. sin internet): la app sigue sin avisar
    cerrarProgreso();
    dialog.showMessageBox(ventana(), {
      type: 'warning',
      title: 'LabTrace',
      message: 'No se pudo descargar la actualización',
      detail: 'Revisa la conexión a internet. Se volverá a ofrecer la próxima vez que abras LabTrace.',
      buttons: ['Aceptar'],
    });
  });

  autoUpdater.on('update-available', async (info) => {
    registrar(`Versión disponible: ${info.version} (instalada: ${app.getVersion()})`);
    const opciones = {
      type: 'info',
      title: 'LabTrace',
      message: `Hay una actualización de LabTrace (${info.version})`,
      detail: `Tienes la versión ${app.getVersion()}. La actualización se descarga, se instala sola y LabTrace se vuelve a abrir.`,
      buttons: ['Actualizar ahora', 'En otro momento'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    };
    const parent = ventana();
    const { response } = parent ? await dialog.showMessageBox(parent, opciones) : await dialog.showMessageBox(opciones);
    if (response !== 0) return registrar('Pospuesta por el usuario');
    progreso = abrirProgreso(ventana(), info.version);
    autoUpdater.downloadUpdate().catch(() => {}); // el evento «error» ya lo informa
  });

  autoUpdater.on('download-progress', ({ percent }) => {
    const avance = Math.max(0, Math.min(100, Math.round(percent)));
    ventana()?.setProgressBar(avance / 100);
    if (progreso && !progreso.isDestroyed()) {
      progreso.webContents.executeJavaScript(`window.avance && window.avance(${avance})`).catch(() => {});
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    registrar(`Descargada ${info.version}; instalando`);
    cerrarProgreso();
    autoUpdater.quitAndInstall(true, true); // instalación silenciosa y reinicio de la app
  });

  autoUpdater.checkForUpdates().catch((error) => registrar(`Consulta fallida: ${error?.message ?? error}`));
}

module.exports = { buscarActualizacion };
