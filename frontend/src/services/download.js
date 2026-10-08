import { apiFetch } from './cases.service.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Mensaje de error de una respuesta fallida de la API */
async function errorDe(res) {
  let message = `Error ${res.status}`;
  try {
    const body = await res.json();
    message = Array.isArray(body.message) ? body.message.join('. ') : body.message || message;
  } catch {
    /* sin JSON */
  }
  return new Error(message);
}

/** Pide dónde guardar el archivo (ventana «Guardar como»). Devuelve null si el navegador no la ofrece. */
async function pedirDestino(nombre) {
  if (typeof window.showSaveFilePicker !== 'function') return null;
  try {
    return await window.showSaveFilePicker({
      suggestedName: nombre,
      types: [{ description: 'Libro de Excel', accept: { [XLSX]: ['.xlsx'] } }],
    });
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelado';
    return null; // sin permiso para abrirla (p. ej. pasó demasiado tiempo desde el clic): descarga normal
  }
}

/**
 * Guarda un archivo de la API: abre «Guardar como» para elegir carpeta y nombre
 * (Chrome y Edge); en otros navegadores lo descarga de forma normal.
 * Devuelve false si la persona cancela la ventana.
 */
export async function downloadFile(path, fallbackName = 'archivo') {
  const destino = await pedirDestino(fallbackName);
  if (destino === 'cancelado') return false;

  let res;
  try {
    res = await apiFetch(path);
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  if (!res.ok) throw await errorDe(res);
  const blob = await res.blob();

  if (destino) {
    const escritura = await destino.createWritable();
    await escritura.write(blob);
    await escritura.close();
    return true;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
