import franjaUrl from '../assets/remision-franja.png';
import tituloUrl from '../assets/remision-titulo.png';
import direccionUrl from '../assets/remision-direccion.png';
import logoUrl from '../assets/remision-logo.png';
import firmaUrl from '../assets/remision-firma.jpeg';
import { cacheImagenes, renglones } from './canvasTexto.js';
import { formatRemisionNumber } from './format.js';
import { ordenarPorTipo } from './protesis.js';
import { imprimirImagen, PAGINAS } from './imprimirImagen.js';

/**
 * Réplica en imagen de la hoja REMISION de backend/templates/remision.xlsx (A1:E27), para imprimirla
 * con su diseño completo y mostrarla en la vista previa. Las medidas salen de la plantilla, en píxeles
 * a 96 ppp (ancho de columna × 7, alto de fila en pt × 4/3); si cambia la plantilla, ajusta estas constantes.
 * Las celdas que se llenan son las mismas de backend/src/remisiones/remision-excel.ts.
 */
const ESCALA = 3; // se dibuja a 288 ppp para que el texto salga nítido
const COLUMNAS = { A: 19, B: 89, C: 391, D: 114, E: 120 }; // 733 px = PAGINAS.remision.anchoImagen
const ULTIMA_FILA = 27; // de la plantilla; con renglones de más el total y la firma bajan
const ALTO_FILA_PT = { 3: 23.25, 4: 13.5, 11: 12, 13: 13.5, 14: 13.5, 15: 18, 17: 13.5, 18: 13.5, 19: 14.25, 20: 14.25, 21: 14.25, 22: 14.25 };
const ALTO_FILA_DEFECTO_PT = 12.75;
const PRIMERA_LINEA = 16;
const MAX_LINEAS = 8; // filas 16 a 23
const INTERLINEADO = 17; // 12.75 pt: lo que crece una fila por cada renglón de más

const FUENTE = 'bold 13.33px Arial, Helvetica, sans-serif'; // Arial 10 negrita
const COLOR_TEXTO = '#595959';
const CELESTE = '#b7dee8';
const GRIS_CLARO = '#e3e3e3';
const GRIS = '#c0c0c0';
const MARGEN = 3; // espacio entre el texto y el borde de la celda

/** Imágenes de la plantilla con su ancla (columna/fila + desplazamiento en px, como en drawing1.xml) */
const IMAGENES = [
  { url: logoUrl, desde: ['B', 1, 74.5, 0], hasta: ['C', 3, 45.2, 26.5] },
  { url: tituloUrl, desde: ['C', 1, 59.8, 7.3], hasta: ['C', 3, 296.3, 30] },
  { url: direccionUrl, desde: ['C', 1, 330.8, 15], hasta: ['E', 3, 80.1, 29] },
  { url: franjaUrl, desde: ['A', 4, 18.3, 2.5], hasta: ['F', 6, 1.3, 2.7] }, // llega a la columna F: el canvas la recorta
  { url: firmaUrl, desde: ['C', 23, 1.7, 5], hasta: ['C', 27, 146.7, 1.2], firma: true },
];
const cargarImagenes = cacheImagenes(IMAGENES.map((imagen) => imagen.url));

const LETRAS = Object.keys(COLUMNAS);
const X = {};
LETRAS.reduce((x, letra) => ((X[letra] = x), x + COLUMNAS[letra]), 0);
X.F = X.E + COLUMNAS.E;
const ANCHO = X.F;

const altoBase = (fila) => ((ALTO_FILA_PT[fila] ?? ALTO_FILA_DEFECTO_PT) * 4) / 3;
const mayus = (texto) => String(texto ?? '').trim().toLocaleUpperCase('es');
const miles = (valor) => String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** La fecha llega como medianoche UTC del día */
const fechaCorta = (iso) =>
  new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

/** Posición de cada fila (en px) según sus altos */
function tops(altos) {
  const top = [0, 0];
  for (let fila = 1; fila < altos.length; fila++) top[fila + 1] = top[fila] + altos[fila];
  return top;
}

/**
 * Cada lado (superior / inferior) de una prótesis con reparto es un renglón propio, como en
 * backend/src/remisiones/remision-excel.ts
 */
function renglonesDeItems(items) {
  // Orden: bases, prótesis sin reparto, todas las superiores, todas las inferiores y al final los adicionales
  const grupoDe = (tipo, lado) => (tipo === 'BASE' ? 0 : tipo === 'ADICIONAL' || !tipo ? 4 : lado === 'SUPERIOR' ? 2 : lado === 'INFERIOR' ? 3 : 1);
  const renglones = ordenarPorTipo(items, (item) => item.producto?.tipo).flatMap((item) => {
    const tipo = item.producto?.tipo;
    const lados = [['SUPERIOR', item.cantidadSuperior], ['INFERIOR', item.cantidadInferior]].filter(([, cantidad]) => cantidad);
    if (lados.length === 0) return [{ grupo: grupoDe(tipo), cantidad: item.cantidad, descripcion: mayus(item.descripcion), valorUnitario: item.valorUnitario }];
    return lados.map(([lado, cantidad]) => ({ grupo: grupoDe(tipo ?? 'PROTESIS', lado), cantidad, descripcion: `${mayus(item.descripcion)} - ${lado}`, valorUnitario: item.valorUnitario }));
  });
  return renglones.map((r, i) => ({ r, i })).sort((a, b) => a.r.grupo - b.r.grupo || a.i - b.i).map(({ r }) => r);
}

export async function generarRemision(remision) {
  const imagenes = await cargarImagenes();
  const items = renglonesDeItems(remision.items ?? []);
  const extra = Math.max(0, items.length - MAX_LINEAS); // renglones de más: el total y la firma bajan
  const filaTotal = PRIMERA_LINEA + MAX_LINEAS + extra; // fila 24 de la plantilla, desplazada
  const ultimaFila = ULTIMA_FILA + extra;
  /** Fila de la plantilla que da el alto de una fila de la hoja (las filas añadidas son como una de datos) */
  const deLaPlantilla = (fila) => (fila < 24 ? fila : fila < 24 + extra ? 19 : fila - extra);
  const clinica = mayus(remision.caso?.cliente?.nombre);
  const doctor = mayus(remision.doctorNombre ?? remision.caso?.doctorNombre);
  const paciente = mayus(remision.pacienteNombre ?? remision.caso?.pacienteNombre);
  const noOrden = mayus(remision.noOrden || remision.caso?.codigo);
  const letras = String(remision.totalEnLetras ?? '');
  const total = items.reduce((suma, item) => suma + item.cantidad * item.valorUnitario, 0);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = FUENTE;

  // ---- Altos de fila: los textos largos saltan de renglón y la fila crece (como en el Excel)
  const altos = [0];
  for (let fila = 1; fila <= ultimaFila; fila++) altos[fila] = altoBase(deLaPlantilla(fila));
  const anchoCombinado = COLUMNAS.C + COLUMNAS.D + COLUMNAS.E - 2 * MARGEN;
  const renglonesDe = {
    9: renglones(ctx, clinica, anchoCombinado),
    10: renglones(ctx, doctor, anchoCombinado),
    11: renglones(ctx, paciente, anchoCombinado),
    14: renglones(ctx, letras, ANCHO - X.B - 2 * MARGEN),
  };
  items.forEach((item, i) => {
    renglonesDe[PRIMERA_LINEA + i] = renglones(ctx, mayus(item.descripcion), COLUMNAS.C - 2 * MARGEN);
  });
  for (const [fila, lineas] of Object.entries(renglonesDe)) {
    if (lineas.length > 1) altos[fila] = Math.max(altos[fila], altoBase(19) + (lineas.length - 1) * INTERLINEADO);
  }
  const top = tops(altos);
  const topBase = tops([0, ...Array.from({ length: ULTIMA_FILA }, (_, i) => altoBase(i + 1))]); // la plantilla sin filas añadidas

  canvas.width = ANCHO * ESCALA;
  canvas.height = Math.ceil(top[ultimaFila + 1] + 4) * ESCALA;
  ctx.scale(ESCALA, ESCALA);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ANCHO, canvas.height / ESCALA);
  ctx.imageSmoothingQuality = 'high';

  const rango = (c1, f1, c2 = c1, f2 = f1) => {
    const x = X[c1];
    const y = top[f1];
    return { x, y, w: X[c2] + COLUMNAS[c2] - x, h: top[f2 + 1] - y };
  };
  const pintar = (r, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  };
  /** Bordes de un rango: `lados` es una combinación de l, t, r, b */
  const marco = (r, lados, color, grosor = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = grosor;
    ctx.beginPath();
    const { x, y, w, h } = r;
    const segmentos = { l: [x, y, x, y + h], r: [x + w, y, x + w, y + h], t: [x, y, x + w, y], b: [x, y + h, x + w, y + h] };
    for (const lado of lados) {
      const [x1, y1, x2, y2] = segmentos[lado];
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  };
  /**
   * Texto en una celda. Vertical: abajo (lo normal en Excel) o centrado; si son varios renglones se centra el bloque.
   * Una sola línea que no cabe reduce la letra.
   */
  const escribir = (r, texto, { alinear = 'left', vertical = 'bottom', lineas, fuente = FUENTE, color = COLOR_TEXTO } = {}) => {
    ctx.fillStyle = color;
    ctx.font = fuente;
    const ancho = r.w - 2 * MARGEN;
    const x = alinear === 'left' ? r.x + MARGEN : alinear === 'right' ? r.x + r.w - MARGEN : r.x + r.w / 2;
    ctx.textAlign = alinear;
    const filas = lineas ?? [String(texto ?? '')];
    if (filas.length > 1) {
      ctx.textBaseline = 'middle';
      const inicio = r.y + r.h / 2 - ((filas.length - 1) * INTERLINEADO) / 2;
      filas.forEach((linea, i) => ctx.fillText(linea, x, inicio + i * INTERLINEADO));
      return;
    }
    ctx.textBaseline = vertical === 'middle' ? 'middle' : 'alphabetic';
    const y = vertical === 'middle' ? r.y + r.h / 2 : r.y + r.h - 4;
    ctx.fillText(filas[0], x, y, ancho);
  };

  // ---- Rellenos celestes
  pintar(rango('B', 13, 'E'), CELESTE);
  pintar(rango('B', 15, 'E'), CELESTE);
  pintar(rango('E', filaTotal), CELESTE);

  // ---- Bordes (los de styles.xml de la plantilla)
  marco(rango('B', 1, 'E'), 'b', GRIS_CLARO);
  marco(rango('B', 3, 'B', 6), 'l', GRIS_CLARO);
  marco(rango('E', 2, 'E', 6), 'r', GRIS_CLARO);
  marco(rango('E', 12), 'r', GRIS_CLARO);
  marco(rango('B', 13, 'E'), 'ltrb', GRIS_CLARO, 2);
  marco(rango('B', 14, 'E'), 'lrb', GRIS_CLARO, 2);
  marco(rango('B', 15), 'ltb', GRIS);
  marco(rango('B', 15), 'r', GRIS_CLARO);
  marco(rango('C', 15), 'tr', GRIS_CLARO);
  marco(rango('E', 15), 'ltb', GRIS);
  for (let fila = PRIMERA_LINEA; fila < PRIMERA_LINEA + MAX_LINEAS + extra - 1; fila++) {
    for (const col of LETRAS.slice(1)) marco(rango(col, fila), 'ltrb', GRIS);
  }
  marco(rango('E', filaTotal - 1), 'ltrb', GRIS);
  marco(rango('B', filaTotal), 'lt', GRIS);
  marco(rango('E', filaTotal), 'ltb', GRIS);
  marco(rango('C', filaTotal + 1), 'b', GRIS);
  marco(rango('D', filaTotal + 1, 'D', filaTotal + 2), 'l', GRIS);
  marco(rango('C', filaTotal + 2), 'lb', GRIS);

  // ---- Logos, franja y firma (la firma arranca en la fila 23; si se usan las 8 líneas, baja una fila)
  IMAGENES.forEach((imagen, i) => {
    const [c1, f1, dx1, dy1] = imagen.desde;
    const [c2, f2, dx2, dy2] = imagen.hasta;
    const baja = imagen.firma && items.length >= MAX_LINEAS ? extra + 1 : 0;
    const w = X[c2] + dx2 - (X[c1] + dx1);
    const h = topBase[f2] + dy2 - (topBase[f1] + dy1);
    if (imagen.firma) ctx.globalCompositeOperation = 'multiply'; // el fondo blanco de la firma no tapa las líneas
    ctx.drawImage(imagenes[i], X[c1] + dx1, top[f1 + baja] + dy1, w, h);
    ctx.globalCompositeOperation = 'source-over';
  });

  // ---- Encabezado
  const rotulos = { 7: 'Remision No', 8: 'Fecha:', 9: 'Clinica :', 10: 'Doctor.(a):', 11: 'Paciente:', 12: 'No Orden:' };
  for (const [fila, texto] of Object.entries(rotulos)) escribir(rango('B', Number(fila)), texto);
  escribir(rango('C', 7), formatRemisionNumber(remision));
  escribir(rango('C', 8, 'E'), remision.fecha ? fechaCorta(remision.fecha) : '');
  escribir(rango('C', 9, 'E'), clinica, { lineas: renglonesDe[9] });
  escribir(rango('C', 10, 'E'), doctor, { lineas: renglonesDe[10] });
  escribir(rango('C', 11, 'E'), paciente, { lineas: renglonesDe[11] });
  escribir(rango('C', 12), noOrden);
  if (remision.anulada) {
    escribir(rango('E', 7), 'ANULADA', { alinear: 'right', vertical: 'middle', fuente: 'bold 21.33px Arial, Helvetica, sans-serif', color: '#c00000' });
  }

  // ---- Valor en letras y encabezado de la tabla
  escribir(rango('B', 13, 'E'), 'DEBE LA SUMA DE:');
  escribir(rango('B', 14, 'E'), letras, { lineas: renglonesDe[14] });
  escribir(rango('B', 15), 'CANTIDAD', { alinear: 'center' });
  escribir(rango('C', 15), 'DESCRIPCION', { alinear: 'center' });
  escribir(rango('E', 15), 'VALOR TOTAL', { alinear: 'center' });

  // ---- Líneas: valor unitario con formato contable ($ a la izquierda) y total a la derecha
  items.forEach((item, i) => {
    const fila = PRIMERA_LINEA + i;
    const centrado = { vertical: 'middle' };
    escribir(rango('B', fila), item.cantidad, { ...centrado, alinear: 'center' });
    escribir(rango('C', fila), mayus(item.descripcion), { ...centrado, lineas: renglonesDe[fila] });
    escribir(rango('D', fila), '$', centrado);
    escribir(rango('D', fila), miles(item.valorUnitario), { ...centrado, alinear: 'right' });
    escribir(rango('E', fila), `$ ${miles(item.cantidad * item.valorUnitario)}`, { ...centrado, alinear: 'right' });
  });

  // ---- Total y firmas
  escribir(rango('D', filaTotal), 'TOTAL');
  escribir(rango('E', filaTotal), `$ ${miles(total)}`, { alinear: 'right' });
  escribir(rango('B', filaTotal + 1), 'FIRMA:');
  escribir(rango('C', filaTotal + 1), 'RECIBI:', { alinear: 'center' });

  return canvas.toDataURL('image/png');
}

/** Abre la ventana de impresión con la remisión ya generada (carta vertical, a tamaño real) */
export const imprimirRemision = (imagenUrl, remision) =>
  imprimirImagen(imagenUrl, { titulo: `Remisión ${formatRemisionNumber(remision)}`, pagina: PAGINAS.remision });
