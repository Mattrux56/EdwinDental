// Decide qué código arranca: el que trae el instalador o una versión más nueva descargada por la propia app.
// Es parte del instalador (no se actualiza por descarga) y debe seguir siendo pequeño y sin dependencias:
// si algo aquí fallara, la app no abriría.
const { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const VERSION = /^\d+\.\d+\.\d+$/;
const INTENTOS_MAXIMOS = 2; // arranques permitidos sin que la versión descargada llegue a mostrar la ventana

const partes = (version) => String(version).split('.').map(Number);
function esMayor(a, b) {
  const [x, y] = [partes(a), partes(b)];
  for (let i = 0; i < 3; i += 1) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

function leerJson(archivo, porDefecto) {
  try {
    return JSON.parse(readFileSync(archivo, 'utf8'));
  } catch {
    return porDefecto;
  }
}

function escribirJson(archivo, datos) {
  mkdirSync(join(archivo, '..'), { recursive: true });
  writeFileSync(`${archivo}.tmp`, JSON.stringify(datos));
  rmSync(archivo, { force: true });
  renameSync(`${archivo}.tmp`, archivo);
}

/**
 * `dirCodigo` es <datos de la app>/code. Devuelve { version, dir } si hay que arrancar una versión descargada,
 * o null para usar el código del instalador. Una versión que no llega a confirmarse tras INTENTOS_MAXIMOS
 * arranques se descarta y se anota en rechazadas.json para no volver a ofrecerla.
 */
function elegirCodigo(dirCodigo, versionInstalada) {
  const archivo = join(dirCodigo, 'current.json');
  const actual = leerJson(archivo, null);
  if (!actual) return null;

  const dir = join(dirCodigo, String(actual.version));
  const usable = VERSION.test(String(actual.version))
    && esMayor(actual.version, versionInstalada)
    && existsSync(join(dir, 'electron', 'app.cjs'));
  if (!usable) {
    rmSync(archivo, { force: true }); // quedó vieja (el instalador ya trae algo igual o más nuevo) o incompleta
    return null;
  }

  if (!actual.confirmada) {
    const intentos = Number(actual.intentos) || 0;
    if (intentos >= INTENTOS_MAXIMOS) {
      const rechazadas = leerJson(join(dirCodigo, 'rechazadas.json'), []);
      escribirJson(join(dirCodigo, 'rechazadas.json'), [...new Set([...rechazadas, actual.version])]);
      rmSync(archivo, { force: true });
      rmSync(dir, { recursive: true, force: true });
      return null;
    }
    escribirJson(archivo, { ...actual, intentos: intentos + 1 });
  }
  return { version: actual.version, dir };
}

/**
 * Carga un paquete instalado junto al instalador (Prisma, actualizador, fflate) aunque el código que lo pide
 * esté en la carpeta de versiones descargadas, donde no hay node_modules.
 */
function requerirDelCasco(nombre) {
  const base = process.env.LABTRACE_NODE_MODULES; // <instalación>/resources/app/node_modules
  return require(base ? require.resolve(nombre, { paths: [join(base, '..')] }) : nombre);
}

module.exports = { elegirCodigo, esMayor, leerJson, escribirJson, requerirDelCasco, VERSION };
