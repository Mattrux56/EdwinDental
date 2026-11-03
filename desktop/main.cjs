// Cargador de LabTrace: arranca el código de la aplicación (app.cjs).
// Si la propia app descargó una versión más nueva (ver codigo.cjs), arranca esa en lugar de la del instalador.
// Así las actualizaciones normales no necesitan un instalador (.exe) nuevo, que es lo que SmartScreen bloquea.
const { app } = require('electron');
const { delimiter, join } = require('node:path');
const Module = require('node:module');
const { elegirCodigo } = require('./cargador.cjs');

app.setName('LabTrace');

let destino = join(__dirname, 'app.cjs');
try {
  // El código descargado vive fuera de la carpeta del instalador y busca sus paquetes (Prisma, actualizador) en la del instalador
  process.env.LABTRACE_NODE_MODULES = join(__dirname, '..', 'node_modules');
  process.env.NODE_PATH = [process.env.LABTRACE_NODE_MODULES, process.env.NODE_PATH].filter(Boolean).join(delimiter);
  Module._initPaths();
  if (app.isPackaged) {
    const elegido = elegirCodigo(join(app.getPath('userData'), 'code'), app.getVersion());
    if (elegido) {
      process.env.LABTRACE_CODE_VERSION = elegido.version;
      process.env.LABTRACE_CODE_DIR = elegido.dir;
      destino = join(elegido.dir, 'electron', 'app.cjs');
    }
  }
} catch {
  /* ante cualquier problema se usa el código del instalador */
}

require(destino);
