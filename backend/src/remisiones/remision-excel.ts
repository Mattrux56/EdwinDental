import ExcelJS from 'exceljs';
import { join } from 'path';
import { totalEnLetras } from './numero-letras';

/**
 * Plantilla: backend/templates/remision.xlsx (la remisión del laboratorio, con logos y firma).
 * El generador solo escribe en las celdas de abajo; si cambia el diseño de la plantilla, ajusta estas constantes.
 *
 *   C7 número · C8 fecha · C9 clínica · C10 doctor(a) · C11 paciente · C12 no. de orden
 *   B14 valor en letras · filas 16-23: B cantidad, C descripción, D valor unitario, E total (fórmula) · E24 total
 *
 * Una prótesis con reparto ocupa un renglón por lado (superior / inferior). Se usan primero las filas 16-23 y, si hacen
 * falta más, se insertan filas de datos y el total y la firma bajan. Las filas conservan la altura de la plantilla.
 */
const PLANTILLA = join(__dirname, '..', '..', 'templates', 'remision.xlsx');
const HOJA = 'REMISION';
const PRIMERA_LINEA = 16;
export const MAX_LINEAS_REMISION = 8; // filas 16 a 23 de la plantilla; también el máximo de productos por remisión (el reparto sup/inf añade filas)

const ULTIMA_FILA = 43; // última fila del área de impresión de la plantilla
const CARACTERES_EN_LETRAS = 80; // el valor en letras ocupa B14:E14

export interface RemisionExcelData {
  numero: number | string;
  /** Fecha sin hora: medianoche UTC del día (así la devuelve Prisma para columnas @db.Date) */
  fecha: Date;
  /** Clínica (cliente del caso) */
  clinica: string;
  /** Doctor(a) que envía el caso */
  doctor: string;
  paciente: string;
  noOrden: string;
  /** Una remisión anulada se descarga con la marca «ANULADA» para que no se use como válida */
  anulada?: boolean;
  /** En las prótesis con reparto, `cantidadSuperior` e `cantidadInferior` salen en renglones aparte bajo la descripción */
  items: { cantidad: number; descripcion: string; valorUnitario: number; cantidadSuperior?: number; cantidadInferior?: number }[];
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
  // En la plantilla la celda de la clínica no viene combinada como las de doctor y paciente
  if (!ws.getCell('C9').isMerged) ws.mergeCells('C9:E9');
  ws.getCell('C9').value = mayus(data.clinica);
  ws.getCell('C10').value = mayus(data.doctor);
  ws.getCell('C11').value = mayus(data.paciente);
  // Un número de orden puramente numérico se guarda como número (igual que la remisión original)
  ws.getCell('C12').value = /^[1-9]\d{0,14}$/.test(data.noOrden.trim())
    ? Number(data.noOrden.trim())
    : mayus(data.noOrden);

  // Nombres largos: el texto salta de renglón en vez de cortarse en el borde de la celda
  for (const [celda, fila, texto] of [['C9', 9, data.clinica], ['C10', 10, data.doctor], ['C11', 11, data.paciente]] as const) {
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

  // ---- Filas
  // Cada lado (superior / inferior) de una prótesis con reparto es un renglón propio, como si fuera un producto aparte
  const filas = data.items.flatMap((item) => {
    const lados = ([['SUPERIOR', item.cantidadSuperior], ['INFERIOR', item.cantidadInferior]] as const).filter(([, cantidad]) => cantidad);
    if (lados.length === 0) return [{ cantidad: item.cantidad, descripcion: mayus(item.descripcion), valorUnitario: item.valorUnitario }];
    return lados.map(([lado, cantidad]) => ({
      cantidad: cantidad as number,
      descripcion: `${mayus(item.descripcion)} - ${lado}`,
      valorUnitario: item.valorUnitario,
    }));
  });

  // Si las filas no caben en las de la plantilla, se insertan filas de datos y todo lo de abajo (total, firma) se corre hacia abajo
  const extra = Math.max(0, filas.length - MAX_LINEAS_REMISION);
  const filaTotal = PRIMERA_LINEA + MAX_LINEAS_REMISION;
  if (extra > 0) {
    const columnas = Math.max(5, ws.columnCount);
    for (let fila = ULTIMA_FILA; fila >= filaTotal; fila--) {
      const origen = ws.getRow(fila);
      const destino = ws.getRow(fila + extra);
      for (let col = 1; col <= columnas; col++) {
        destino.getCell(col).value = origen.getCell(col).value;
        destino.getCell(col).style = { ...origen.getCell(col).style };
      }
      destino.height = origen.height;
    }
    const modelo = ws.getRow(PRIMERA_LINEA + 3); // una fila de datos de la plantilla
    for (let fila = filaTotal; fila < filaTotal + extra; fila++) {
      for (let col = 1; col <= columnas; col++) {
        ws.getRow(fila).getCell(col).value = null;
        ws.getRow(fila).getCell(col).style = { ...modelo.getCell(col).style };
      }
      ws.getRow(fila).height = modelo.height;
    }
  }

  // La plantilla trae las fórmulas de la columna E como fórmula compartida; se reescriben una por una
  // para que ExcelJS no deje copias apuntando a una celda maestra que se sobrescribe
  for (let fila = PRIMERA_LINEA; fila < filaTotal + extra; fila++) {
    ws.getCell(`E${fila}`).value = { formula: `+B${fila}*D${fila}`, result: 0 };
  }
  let total = 0;
  filas.forEach((item, i) => {
    const fila = PRIMERA_LINEA + i;
    const subtotal = item.cantidad * item.valorUnitario;
    total += subtotal;

    ws.getCell(`B${fila}`).value = item.cantidad;
    const descripcion = ws.getCell(`C${fila}`);
    descripcion.value = item.descripcion;
    ws.getCell(`D${fila}`).value = item.valorUnitario;
    ws.getCell(`E${fila}`).value = { formula: `+B${fila}*D${fila}`, result: subtotal };

    // La fila conserva la altura de la plantilla: si la descripción no cabe, se reduce la letra en vez de agrandar la fila
    descripcion.alignment = { ...descripcion.alignment, wrapText: false, shrinkToFit: true, vertical: 'middle' };
    for (const col of ['B', 'D', 'E']) {
      const celda = ws.getCell(`${col}${fila}`);
      celda.alignment = { ...celda.alignment, vertical: 'middle' };
    }
  });

  // La imagen de la firma arranca en la fila 23, que es la línea 8: si esa línea se usa, se baja (junto con las filas insertadas) para no taparla
  if (filas.length >= MAX_LINEAS_REMISION) {
    for (const img of ws.getImages()) {
      const { tl, br } = img.range as any;
      if (tl.nativeRow === PRIMERA_LINEA + MAX_LINEAS_REMISION - 2 && br) {
        tl.nativeRow += extra + 1;
        br.nativeRow += extra + 1;
      }
    }
  }

  // ---- Total (en número y en letras)
  ws.getCell(`E${filaTotal + extra}`).value = { formula: `SUM(E${PRIMERA_LINEA}:E${filaTotal + extra - 1})`, result: total };
  const enLetras = ws.getCell('B14');
  enLetras.value = totalEnLetras(total);
  if (String(enLetras.value).length > CARACTERES_EN_LETRAS) {
    enLetras.alignment = { ...enLetras.alignment, wrapText: true, vertical: 'middle' };
    ws.getRow(14).height = 27;
  }

  // exceljs reescribe mal el área de impresión al cargar la plantilla; esta forma produce $A$1:$E$43
  ws.pageSetup.printArea = `A$1:E$${ULTIMA_FILA + extra}`;

  wb.calcProperties.fullCalcOnLoad = true; // Excel recalcula al abrir
  return Buffer.from(await wb.xlsx.writeBuffer());
}
