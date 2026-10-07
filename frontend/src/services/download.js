import { apiFetch } from './cases.service.js';

/** Nombre de archivo que envía el servidor en Content-Disposition */
function fileNameFrom(res, fallback) {
  const header = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : fallback;
}

/** Descarga un archivo de la API */
export async function downloadFile(path, fallbackName = 'archivo') {
  let res;
  try {
    res = await apiFetch(path);
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join('. ') : body.message || message;
    } catch {
      /* sin JSON */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileNameFrom(res, fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
