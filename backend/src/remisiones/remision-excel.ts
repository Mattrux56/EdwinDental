import ExcelJS from 'exceljs';
import { join } from 'path';
import { totalEnLetras } from './numero-letras';

/**
 * Plantilla: backend/templates/remision.xlsx (la remisión del laboratorio, con logos y firma).
 * El generador solo escribe en las celdas de abajo; si cambia el diseño de la plantilla, ajusta estas constantes.
 *
 *   C7 número · C8 fecha · C9 doctor(a)/clínica · C10 paciente · C11 no. de orden
 *   B13 valor en letras · filas 15-23: B cantidad, C descripción, D valor unitario, E total (fórmula) · E24 total
 */
const PLANTILLA = join(__dirname, '..', '..', 'templates', 'remision.xlsx');
const HOJA = 'REMISION';
const PRIMERA_LINEA = 15;
export const MAX_LINEAS_REMISION = 9; // filas 15 a 23 de la plantilla

const ALTO_FILA = 14.25; // alto de las filas de la plantilla
const CARACTERES_POR_RENGLON = 42; // descripción en negrita y mayúsculas dentro de la columna C
const CARACTERES_EN_LETRAS = 80; // el valor en letras ocupa B13:E13

export interface RemisionExcelData {
  numero: number;
  /** Fecha sin hora: medianoche UTC del día (así la devuelve Prisma para columnas @db.Date) */
  fecha: Date;
  /** Doctor(a) o clínica (cliente del caso) */
  doctor: string;
  paciente: string;
  noOrden: string;
  /** Una remisión anulada se descarga con la marca «ANULADA» para que no se use como válida */
  anulada?: boolean;
  items: { cantidad: number; descripcion: string; valorUnitario: number }[];
}

const mayus = (texto: string) => texto.trim().toLocaleUpperCase('es');

export async function generarRemisionExcel(data: RemisionExcelData): Promise<Buffer> {
  if (data.items.length === 0) throw new RangeError('La remisión no tiene productos');
  if (data.items.length > MAX_LINEAS_REMISION) {
    throw new RangeError(`La remisión admite máximo ${MAX_LINEAS_REMISION} productos`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANTILLA);
  const ws = wb.getWorksheet(HOJA);
  if (!ws) throw new Error(`La plantilla ${PLANTILLA} no tiene la hoja "${HOJA}"`);

  // ---- Encabezado
  ws.getCell('C7').value = data.numero;
  const fecha = ws.getCell('C8');
  fecha.value = data.fecha;
  fecha.numFmt = 'dd/mm/yyyy';
  ws.getCell('C9').value = mayus(data.doctor);
  ws.getCell('C10').value = mayus(data.paciente);
  // Un número de orden puramente numérico se guarda como número (igual que la remisión original)
  ws.getCell('C11').value = /^[1-9]\d{0,14}$/.test(data.noOrden.trim())
    ? Number(data.noOrden.trim())
    : mayus(data.noOrden);

  // Nombres largos: el texto salta de renglón en vez de cortarse en el borde de la celda
  for (const [celda, fila, texto] of [['C9', 9, data.doctor], ['C10', 10, data.paciente]] as const) {
    if (texto.length > 70) {
      const c = ws.getCell(celda);
      c.style = { ...c.style, alignment: { ...c.alignment, wrapText: true, vertical: 'middle' } };
      ws.getRow(fila).height = 27;
    }
  }

  if (data.anulada) {
    const marca = ws.getCell('E7');
    marca.value = 'ANULADA';
    // Se asigna un estilo nuevo: ExcelJS comparte el objeto de estilo entre celdas iguales y, si se edita en sitio, el cambio se contagia
    marca.style = {
      ...marca.style,
      font: { name: 'Arial', size: 16, bold: true, color: { argb: 'FFC00000' } },
      alignment: { horizontal: 'right', vertical: 'middle' },
    };
  }

  // ---- Líneas
  let total = 0;
  data.items.forEach((item, i) => {
    const fila = PRIMERA_LINEA + i;
    const subtotal = item.cantidad * item.valorUnitario;
    total += subtotal;

    ws.getCell(`B${fila}`).value = item.cantidad;
    const descripcion = ws.getCell(`C${fila}`);
    descripcion.value = mayus(item.descripcion);
    ws.getCell(`D${fila}`).value = item.valorUnitario;
    ws.getCell(`E${fila}`).value = { formula: `+B${fila}*D${fila}`, result: subtotal };

    // Las descripciones largas hacen salto de renglón y la fila crece (centrando el resto de la fila)
    const renglones = Math.max(1, Math.ceil(String(descripcion.value).length / CARACTERES_POR_RENGLON));
    descripcion.alignment = { ...descripcion.alignment, wrapText: true, vertical: 'middle' };
    for (const col of ['B', 'D', 'E']) {
      const celda = ws.getCell(`${col}${fila}`);
      celda.alignment = { ...celda.alignment, vertical: 'middle' };
    }
    if (renglones > 1) ws.getRow(fila).height = ALTO_FILA + (renglones - 1) * 12.75;
  });

  // La imagen de la firma arranca en la fila 23, que es la línea 9: si se usa, se baja una fila para no taparla
  if (data.items.length === MAX_LINEAS_REMISION) {
    for (const img of ws.getImages()) {
      const { tl, br } = img.range as any;
      if (tl.nativeRow === PRIMERA_LINEA + MAX_LINEAS_REMISION - 2 && br) {
        tl.nativeRow += 1;
        br.nativeRow += 1;
      }
    }
  }

  // ---- Total (en número y en letras)
  ws.getCell('E24').value = { formula: `SUM(E${PRIMERA_LINEA}:E${PRIMERA_LINEA + MAX_LINEAS_REMISION - 1})`, result: total };
  const enLetras = ws.getCell('B13');
  enLetras.value = totalEnLetras(total);
  if (String(enLetras.value).length > CARACTERES_EN_LETRAS) {
    enLetras.alignment = { ...enLetras.alignment, wrapText: true, vertical: 'middle' };
    ws.getRow(13).height = 27;
  }

  // exceljs reescribe mal el área de impresión al cargar la plantilla; esta forma produce $A$1:$E$43
  ws.pageSetup.printArea = 'A$1:E$43';

  wb.calcProperties.fullCalcOnLoad = true; // Excel recalcula al abrir
  return Buffer.from(await wb.xlsx.writeBuffer());
}
