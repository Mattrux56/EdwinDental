// Actualización por código: en cada versión se publica un paquete .zip con el código de la aplicación
// (servidor, interfaz y pantallas de escritorio). La app lo descarga, comprueba su huella y lo deja en
// <datos de la app>/code/<versión>; main.cjs lo arranca la próxima vez. No se ejecuta ningún .exe nuevo,
// así que Windows SmartScreen no interviene. Solo cuando cambia el «casco» (Electron, Prisma) hace falta el instalador.
//
// No depende de Electron para poder probarse con Node.
const { createHash } = require('node:crypto');
const { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } = require('node:fs');
const { dirname, isAbsolute, join, normalize, sep } = require('node:path');
const { VERSION, escribirJson, esMayor, leerJson, requerirDelCasco } = require('./cargador.cjs');

const URL_POR_DEFECTO = 'https://github.com/Mattrux56/EdwinDental/releases/latest/download/';
const TAMANO_MAXIMO = 200 * 1024 * 1024;

/** Dónde buscar el manifiesto y el paquete. La variable solo vale en pruebas (LABTRACE_PRUEBAS=1) */
function urlBase() {
  const base = process.env.LABTRACE_PRUEBAS === '1' && process.env.LABTRACE_ACTUALIZACIONES_URL
    ? process.env.LABTRACE_ACTUALIZACIONES_URL
    : URL_POR_DEFECTO;
  return base.endsWith('/') ? base : `${base}/`;
}

/** Descarga y valida code-latest.json. Devuelve null si no se puede (sin internet, sin manifiesto, datos raros) */
async function leerManifiesto({ fetchFn = fetch, base = urlBase() } = {}) {
  try {
    const res = await fetchFn(`${base}code-latest.json`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const m = await res.json();
    const valido = VERSION.test(String(m.version))
      && /^[\w.-]+\.zip$/.test(String(m.archivo))
      && typeof m.sha512 === 'string' && m.sha512.length > 20
      && Number.isInteger(m.tamano) && m.tamano > 0 && m.tamano <= TAMANO_MAXIMO
      && typeof m.casco === 'string' && m.casco.length > 0;
    return valido ? m : null;
  } catch {
    return null;
  }
}

/**
 * Qué hacer con el manifiesto: 'nada' (ya está al día o esa versión se descartó antes),
 * 'instalador' (cambió el casco: hace falta el instalador completo) o 'codigo' (basta el paquete de código).
 */
function evaluar(manifiesto, { versionCodigo, cascoInstalado, dirCodigo }) {
  if (!manifiesto || !esMayor(manifiesto.version, versionCodigo)) return 'nada';
  if (manifiesto.casco !== cascoInstalado) return 'instalador';
  const rechazadas = dirCodigo ? leerJson(join(dirCodigo, 'rechazadas.json'), []) : [];
  return rechazadas.includes(manifiesto.version) ? 'nada' : 'codigo';
}

/** Descarga el paquete y comprueba tamaño y huella sha512 (base64). Lanza un Error si algo no coincide */
async function descargar(manifiesto, { fetchFn = fetch, base = urlBase(), alProgreso } = {}) {
  const res = await fetchFn(`${base}${manifiesto.archivo}`, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!res.ok || !res.body) throw new Error(`La descarga respondió ${res.status}`);
  const trozos = [];
  let recibido = 0;
  for await (const trozo of res.body) {
    trozos.push(Buffer.from(trozo));
    recibido += trozo.length;
    if (recibido > manifiesto.tamano) throw new Error('El paquete es más grande de lo esperado');
    alProgreso?.(Math.round((recibido / manifiesto.tamano) * 100));
  }
  const datos = Buffer.concat(trozos);
  if (datos.length !== manifiesto.tamano) throw new Error('El paquete llegó incompleto');
  const huella = createHash('sha512').update(datos).digest('base64');
  if (huella !== manifiesto.sha512) throw new Error('La huella del paquete no coincide: se descarta');
  return datos;
}

/** Descomprime el zip en `destino` rechazando rutas que se salgan de la carpeta */
function descomprimir(datos, destino) {
  const { unzipSync } = requerirDelCasco('fflate');
  const archivos = unzipSync(new Uint8Array(datos));
  const raiz = normalize(destino + sep);
  for (const [nombre, contenido] of Object.entries(archivos)) {
    if (nombre.endsWith('/')) continue;
    const ruta = normalize(join(destino, nombre));
    if (isAbsolute(nombre) || nombre.includes('..') || !ruta.startsWith(raiz)) {
      throw new Error(`El paquete trae una ruta no permitida: ${nombre}`);
    }
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, contenido);
  }
  if (!Object.keys(archivos).some((n) => n === 'electron/app.cjs')) throw new Error('El paquete no trae electron/app.cjs');
}

/** Deja solo las versiones indicadas (la que se usa y la anterior); borra el resto y restos de descargas a medias */
function limpiar(dirCodigo, conservar) {
  try {
    for (const nombre of readdirSync(dirCodigo, { withFileTypes: true })) {
      if (nombre.isDirectory() && !conservar.includes(nombre.name)) {
        rmSync(join(dirCodigo, nombre.name), { recursive: true, force: true });
      }
    }
  } catch {
    /* no es crítico */
  }
}

/**
 * Descarga, verifica, descomprime y deja la versión lista para el próximo arranque (current.json).
 * No reinicia la app: eso lo hace quien la llama.
 */
async function instalar(manifiesto, { dirCodigo, versionCodigo, fetchFn, base, alProgreso }) {
  const datos = await descargar(manifiesto, { fetchFn, base, alProgreso });
  const temporal = join(dirCodigo, `${manifiesto.version}.tmp`);
  const final = join(dirCodigo, manifiesto.version);
  rmSync(temporal, { recursive: true, force: true });
  rmSync(final, { recursive: true, force: true });
  mkdirSync(temporal, { recursive: true });
  try {
    descomprimir(datos, temporal);
    renameSync(temporal, final);
  } catch (error) {
    rmSync(temporal, { recursive: true, force: true });
    throw error;
  }
  const anterior = leerJson(join(dirCodigo, 'current.json'), null)?.version ?? null;
  escribirJson(join(dirCodigo, 'current.json'), { version: manifiesto.version, confirmada: false, intentos: 0, anterior });
  limpiar(dirCodigo, [manifiesto.version, anterior, VERSION.test(String(versionCodigo)) ? versionCodigo : null].filter(Boolean));
  return final;
}

/** La versión descargada arrancó bien: ya no se vigila */
function confirmar(dirCodigo, version) {
  const archivo = join(dirCodigo, 'current.json');
  const actual = leerJson(archivo, null);
  if (actual && actual.version === version && !actual.confirmada) escribirJson(archivo, { ...actual, confirmada: true, intentos: 0 });
}

module.exports = { confirmar, descargar, descomprimir, evaluar, instalar, leerManifiesto, urlBase };
