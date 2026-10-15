import plantillaUrl from '../assets/nota-plantilla.jpg';
import firmaUrl from '../assets/nota-firma.png';

/**
 * La nota es la plantilla del laboratorio (assets/nota-plantilla.jpg, 2000 × 1414 px, horizontal) con los datos escritos encima.
 * Las posiciones están en píxeles de la plantilla; si cambia la imagen, ajusta estas constantes.
 */
const ANCHO_PLANTILLA = 2000;
const ALTO_PLANTILLA = 1414;

/** Texto dentro de cada recuadro: x/y es el inicio de la línea base, ancho el espacio útil */
const LINEAS = {
  paciente: { x: 250, y: 410, ancho: 730 },
  fecha: { x: 1220, y: 410, ancho: 700 },
  doctor: { x: 250, y: 509, ancho: 730 },
  clinica: { x: 1220, y: 509, ancho: 700 },
};
const OBSERVACIONES = { x: 90, y: 640, ancho: 1820, alto: 600 };
const FIRMA = { x: 250, base: 1380, alto: 150, anchoMax: 700 };

const COLOR_TEXTO = '#14212e';
const FUENTE = 'Arial, Helvetica, sans-serif';

const cargarImagen = (url) =>
  new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error('No se pudo cargar la plantilla de la nota.'));
    imagen.src = url;
  });

let imagenes = null;
const cargarImagenes = () => {
  imagenes ??= Promise.all([cargarImagen(plantillaUrl), cargarImagen(firmaUrl)]).catch((error) => {
    imagenes = null;
    throw error;
  });
  return imagenes;
};

/** «2026-10-14T…» → «14/10/2026» en la hora local */
const fechaCorta = (iso) =>
  new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

/** Escribe una línea; si no cabe en el ancho, reduce la letra */
function escribirLinea(ctx, texto, { x, y, ancho }, tamano = 36) {
  let t = tamano;
  do {
    ctx.font = `bold ${t}px ${FUENTE}`;
  } while (ctx.measureText(texto).width > ancho && --t > 16);
  ctx.fillText(texto, x, y, ancho);
}

/** Parte el texto en renglones que caben en `ancho` (respeta los saltos de línea y corta palabras muy largas) */
function renglones(ctx, texto, ancho) {
  const salida = [];
  for (const parrafo of texto.split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let resto = palabra;
      while (ctx.measureText(resto).width > ancho) {
        let corte = resto.length - 1;
        while (corte > 1 && ctx.measureText(resto.slice(0, corte)).width > ancho) corte--;
        if (actual) salida.push(actual);
        salida.push(resto.slice(0, corte));
        actual = '';
        resto = resto.slice(corte);
      }
      const prueba = actual ? `${actual} ${resto}` : resto;
      if (ctx.measureText(prueba).width <= ancho) {
        actual = prueba;
      } else {
        salida.push(actual);
        actual = resto;
      }
    }
    salida.push(actual);
  }
  return salida;
}

/** La observación en grande; baja el tamaño de letra hasta que quepa en el recuadro */
function escribirObservacion(ctx, texto) {
  const { x, y, ancho, alto } = OBSERVACIONES;
  for (let t = 64; t >= 24; t--) {
    ctx.font = `${t}px ${FUENTE}`;
    const interlineado = t * 1.35;
    const lineas = renglones(ctx, texto, ancho);
    if (lineas.length * interlineado <= alto || t === 24) {
      // Con la letra mínima, lo que no quepa se corta para no salirse del recuadro
      const caben = Math.floor(alto / interlineado);
      lineas.slice(0, caben).forEach((linea, i) => ctx.fillText(linea, x, y + t + i * interlineado));
      return;
    }
  }
}

/** Genera la nota llena como imagen JPG (data URL) */
export async function generarNota(nota) {
  const [plantilla, firma] = await cargarImagenes();
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO_PLANTILLA;
  canvas.height = ALTO_PLANTILLA;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(plantilla, 0, 0, ANCHO_PLANTILLA, ALTO_PLANTILLA);

  ctx.fillStyle = COLOR_TEXTO;
  escribirLinea(ctx, (nota.paciente || '').toLocaleUpperCase('es'), LINEAS.paciente);
  escribirLinea(ctx, fechaCorta(nota.fecha), LINEAS.fecha);
  escribirLinea(ctx, (nota.doctor || '').toLocaleUpperCase('es'), LINEAS.doctor);
  escribirLinea(ctx, (nota.clinica || '').toLocaleUpperCase('es'), LINEAS.clinica);
  escribirObservacion(ctx, (nota.observacion || '').toLocaleUpperCase('es'));

  // Firma sobre la línea; «multiply» deja ver la plantilla a través del fondo blanco de la imagen
  const proporcion = firma.naturalWidth / firma.naturalHeight;
  const ancho = Math.min(FIRMA.anchoMax, FIRMA.alto * proporcion);
  const alto = ancho / proporcion;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(firma, FIRMA.x, FIRMA.base - alto, ancho, alto);
  ctx.globalCompositeOperation = 'source-over';

  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Abre la ventana de impresión con la nota ya generada (una página) */
export async function imprimirNota(imagenUrl) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>Nota</title>
<style>
  @page { size: landscape; margin: 10mm; }
  html, body { margin: 0; height: 100%; }
  img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: top center; }
</style></head><body><img src="${imagenUrl}" alt="Nota" /></body></html>`);
  doc.close();
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => {})));
  frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
  frame.contentWindow.focus();
  frame.contentWindow.print();
}

/** data URL → Blob sin esperas (así «Guardar como» se abre justo después del clic) */
function aBlob(dataUrl) {
  const [cabecera, b64] = dataUrl.split(',');
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: cabecera.slice(5, cabecera.indexOf(';')) });
}

/**
 * Guarda la nota como imagen JPG: abre «Guardar como» en Chrome y Edge;
 * en otros navegadores la descarga de forma normal. Devuelve false si la persona cancela.
 */
export async function guardarNota(imagenUrl, nombre) {
  const blob = aBlob(imagenUrl);

  if (typeof window.showSaveFilePicker === 'function') {
    let destino = null;
    try {
      destino = await window.showSaveFilePicker({
        suggestedName: nombre,
        types: [{ description: 'Imagen JPG', accept: { 'image/jpeg': ['.jpg'] } }],
      });
    } catch (error) {
      if (error?.name === 'AbortError') return false;
    }
    if (destino) {
      const escritura = await destino.createWritable();
      await escritura.write(blob);
      await escritura.close();
      return true;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
