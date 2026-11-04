import ExcelJS from 'exceljs';

/** Una remisión vigente de un cliente, como la devuelve CuentasCobroService.listar() */
export interface LineaCuenta {
  numero: number;
  tipo: string;
  fecha: Date;
  noOrden: string | null;
  paciente: string | null;
  ordenTrabajo: string | null;
  total: number;
  pagada: boolean;
  pagadaEn: Date | null;
}

export interface ClienteCuenta {
  cliente: string;
  remisiones: LineaCuenta[];
}

const MONEDA = '"$ "#,##0';
const FECHA = 'dd/mm/yyyy';
const FILAS_LIBRES = 50;
const COLOR_ENCABEZADO = 'FF0B8A7A';
const NOMBRE_RESUMEN = 'RESUMEN';

// Colores del formato condicional (relleno suave + texto oscuro)
const VERDE = { fondo: 'FFDCF2E4', texto: 'FF17713A' };
const AMARILLO = { fondo: 'FFFFF3C4', texto: 'FF7A5B00' };
const ROJO = { fondo: 'FFFBE3E1', texto: 'FFB3261E' };
const AZUL_PAGO = 'FFE3F0FB';

/** Letras de las columnas de cada hoja de cliente */
const COL = { fecha: 'A', paciente: 'B', orden: 'C', cc: 'D', debe: 'E', haber: 'F', saldo: 'G', estado: 'H' } as const;

/** Nombre de hoja válido para Excel: sin \ / ? * [ ] :, hasta 31 caracteres y sin repetirse (ni con RESUMEN) */
export function nombreDeHoja(nombre: string, usados: Set<string>): string {
  const base = nombre.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '') || 'Cliente';
  let candidato = base.slice(0, 31).trim();
  for (let n = 2; usados.has(candidato.toLowerCase()); n += 1) {
    const sufijo = ` (${n})`;
    candidato = `${base.slice(0, 31 - sufijo.length).trim()}${sufijo}`;
  }
  usados.add(candidato.toLowerCase());
  return candidato;
}

const referencia = (hoja: string) => `'${hoja.replace(/'/g, "''")}'`;

/** Fecha de calendario (sin hora) como medianoche UTC, que es como Excel guarda un día */
const soloDia = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const diaLocal = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

interface Movimiento {
  fecha: Date;
  orden: 0 | 1; // 0 = remisión (DEBE), 1 = pago (HABER); el mismo día la remisión va antes que su pago
  numero: number;
  linea: LineaCuenta;
}

const etiquetaRemision = (l: LineaCuenta) => (l.tipo === 'ELECTRONICA' ? `FE-${l.numero}` : String(l.numero));

function movimientos(remisiones: LineaCuenta[]): Movimiento[] {
  const lista: Movimiento[] = [];
  for (const linea of remisiones) {
    const dia = soloDia(linea.fecha);
    lista.push({ fecha: dia, orden: 0, numero: linea.numero, linea });
    if (linea.pagada) {
      // El pago no puede ser anterior a la remisión que paga
      const pagoEn = linea.pagadaEn ? diaLocal(linea.pagadaEn) : dia;
      lista.push({ fecha: pagoEn < dia ? dia : pagoEn, orden: 1, numero: linea.numero, linea });
    }
  }
  return lista.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.orden - b.orden || a.numero - b.numero);
}

/** Estado de una remisión según los pagos acumulados frente a lo remitido acumulado (los pagos cubren lo más antiguo primero) */
const estadoAcumulado = (remitidoAcum: number, debe: number, pagosTotales: number) =>
  pagosTotales >= remitidoAcum ? 'PAGADA' : pagosTotales > remitidoAcum - debe ? 'ABONADA' : 'PENDIENTE';

interface ResumenHoja {
  hoja: string;
  cliente: string;
  remitido: number;
  pagado: number;
  sinPagar: number;
}

function estiloEncabezado(fila: ExcelJS.Row, columnas: number) {
  for (let c = 1; c <= columnas; c += 1) {
    const celda = fila.getCell(c);
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO } };
    celda.alignment = { vertical: 'middle', horizontal: c >= 5 && columnas === 8 ? 'right' : 'left' };
  }
  fila.height = 22;
}

let prioridad = 0; // ExcelJS pide una prioridad distinta por regla
const regla = (formula: string, estilo: { fondo?: string; texto?: string }): ExcelJS.ConditionalFormattingRule => ({
  type: 'expression',
  formulae: [formula],
  priority: ++prioridad,
  style: {
    ...(estilo.fondo ? { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: estilo.fondo } } } : {}),
    ...(estilo.texto ? { font: { color: { argb: estilo.texto } } } : {}),
  },
});

/** Hoja de un cliente: remisiones en DEBE, pagos en HABER, SALDO y ESTADO como fórmulas, y filas libres al final */
function hojaCliente(wb: ExcelJS.Workbook, nombreHoja: string, cuenta: ClienteCuenta): ResumenHoja {
  const ws = wb.addWorksheet(nombreHoja);
  ws.columns = [
    { header: 'FECHA', key: 'fecha', width: 12 },
    { header: 'PACIENTE', key: 'paciente', width: 30 },
    { header: 'ORDEN', key: 'orden', width: 18 },
    { header: 'C. DE C.', key: 'cc', width: 22 },
    { header: 'DEBE', key: 'debe', width: 16 },
    { header: 'HABER', key: 'haber', width: 16 },
    { header: 'SALDO', key: 'saldo', width: 16 },
    { header: 'ESTADO', key: 'estado', width: 14 },
  ];
  estiloEncabezado(ws.getRow(1), 8);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const filas = movimientos(cuenta.remisiones);
  const pagosTotales = filas.filter((m) => m.orden === 1).reduce((a, m) => a + m.linea.total, 0);
  const ultima = 1 + filas.length + FILAS_LIBRES;

  let debeAcum = 0;
  let haberAcum = 0;
  for (let i = 0; i < filas.length + FILAS_LIBRES; i += 1) {
    const n = i + 2;
    const m = filas[i];
    const fila = ws.getRow(n);

    if (m) {
      const l = m.linea;
      fila.getCell(COL.fecha).value = m.fecha;
      fila.getCell(COL.paciente).value = l.paciente ?? '';
      fila.getCell(COL.orden).value = l.ordenTrabajo ?? l.noOrden ?? '';
      if (m.orden === 0) {
        fila.getCell(COL.cc).value = etiquetaRemision(l);
        fila.getCell(COL.debe).value = l.total;
        debeAcum += l.total;
      } else {
        fila.getCell(COL.cc).value = `PAGO REM. N° ${etiquetaRemision(l)}`;
        fila.getCell(COL.haber).value = l.total;
        haberAcum += l.total;
      }
    }

    const vacia = !m;
    const esDebe = m?.orden === 0;
    fila.getCell(COL.saldo).value = {
      formula: `IF(AND(${COL.debe}${n}="",${COL.haber}${n}=""),"",SUM(${COL.debe}$2:${COL.debe}${n})-SUM(${COL.haber}$2:${COL.haber}${n}))`,
      result: vacia ? '' : debeAcum - haberAcum,
    };
    fila.getCell(COL.estado).value = {
      formula:
        `IF(${COL.debe}${n}="","",IF(SUM(${COL.haber}:${COL.haber})>=SUM(${COL.debe}$2:${COL.debe}${n}),"PAGADA",` +
        `IF(SUM(${COL.haber}:${COL.haber})>SUM(${COL.debe}$2:${COL.debe}${n})-${COL.debe}${n},"ABONADA","PENDIENTE")))`,
      result: esDebe ? estadoAcumulado(debeAcum, m.linea.total, pagosTotales) : '',
    };

    fila.getCell(COL.fecha).numFmt = FECHA;
    for (const c of [COL.debe, COL.haber, COL.saldo]) {
      fila.getCell(c).numFmt = MONEDA;
      fila.getCell(c).alignment = { horizontal: 'right' };
    }
    fila.getCell(COL.estado).alignment = { horizontal: 'center' };
  }

  ws.autoFilter = { from: 'A1', to: `H${ultima}` };

  // Colores con formato condicional: se recalculan al editar (no son pintados fijos)
  ws.addConditionalFormatting({
    ref: `A2:H${ultima}`,
    rules: [regla(`$${COL.haber}2<>""`, { fondo: AZUL_PAGO })],
  });
  ws.addConditionalFormatting({
    ref: `${COL.estado}2:${COL.estado}${ultima}`,
    rules: [
      regla(`$${COL.estado}2="PAGADA"`, { fondo: VERDE.fondo, texto: VERDE.texto }),
      regla(`$${COL.estado}2="ABONADA"`, { fondo: AMARILLO.fondo, texto: AMARILLO.texto }),
      regla(`$${COL.estado}2="PENDIENTE"`, { fondo: ROJO.fondo, texto: ROJO.texto }),
    ],
  });
  ws.addConditionalFormatting({
    ref: `${COL.saldo}2:${COL.saldo}${ultima}`,
    rules: [
      regla(`AND(ISNUMBER($${COL.saldo}2),$${COL.saldo}2>0)`, { texto: ROJO.texto }),
      regla(`AND(ISNUMBER($${COL.saldo}2),$${COL.saldo}2<=0)`, { texto: VERDE.texto }),
    ],
  });

  // Cuántas remisiones siguen sin pagarse del todo (para el RESUMEN, con el mismo cálculo que la hoja)
  let acum = 0;
  let sinPagar = 0;
  for (const m of filas) {
    if (m.orden !== 0) continue;
    acum += m.linea.total;
    if (estadoAcumulado(acum, m.linea.total, pagosTotales) !== 'PAGADA') sinPagar += 1;
  }
  return { hoja: nombreHoja, cliente: cuenta.cliente, remitido: debeAcum, pagado: haberAcum, sinPagar };
}

/**
 * Excel de las cuentas de estado: hoja RESUMEN al inicio y una hoja por cliente.
 * Todo lo calculado (SALDO, ESTADO, totales) son fórmulas, así que se actualiza al editar el archivo.
 */
export async function generarCuentasExcel(clientes: ClienteCuenta[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties = { fullCalcOnLoad: true }; // Excel recalcula todo al abrir (los valores guardados son solo de respaldo)
  const resumen = wb.addWorksheet(NOMBRE_RESUMEN);
  const usados = new Set<string>([NOMBRE_RESUMEN.toLowerCase(), 'history']);

  const conRemisiones = clientes.filter((c) => c.remisiones.length > 0);
  const hojas = conRemisiones.map((cuenta) => hojaCliente(wb, nombreDeHoja(cuenta.cliente, usados), cuenta));

  resumen.columns = [
    { header: 'CLIENTE', key: 'cliente', width: 38 },
    { header: 'REMITIDO', key: 'remitido', width: 18 },
    { header: 'PAGADO', key: 'pagado', width: 18 },
    { header: 'SALDO', key: 'saldo', width: 18 },
    { header: 'REM. SIN PAGAR', key: 'sinPagar', width: 16 },
  ];
  estiloEncabezado(resumen.getRow(1), 5);
  for (let c = 2; c <= 5; c += 1) resumen.getRow(1).getCell(c).alignment = { vertical: 'middle', horizontal: 'right' };
  resumen.views = [{ state: 'frozen', ySplit: 2 }];

  const LIMITE = 1000; // el total general suma un rango amplio: agregar clientes debajo no lo rompe
  const total = resumen.getRow(2);
  total.getCell(1).value = 'TOTAL GENERAL';
  const suma = (col: string, valor: number) => ({ formula: `SUM(${col}3:${col}${LIMITE})`, result: valor });
  total.getCell(2).value = suma('B', hojas.reduce((a, h) => a + h.remitido, 0));
  total.getCell(3).value = suma('C', hojas.reduce((a, h) => a + h.pagado, 0));
  total.getCell(4).value = suma('D', hojas.reduce((a, h) => a + h.remitido - h.pagado, 0));
  total.getCell(5).value = suma('E', hojas.reduce((a, h) => a + h.sinPagar, 0));
  total.font = { bold: true };
  total.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3F2' } };
    celda.border = { bottom: { style: 'thin', color: { argb: 'FF9FB4B1' } } };
  });

  hojas.forEach((h, i) => {
    const n = i + 3;
    const ref = referencia(h.hoja);
    const fila = resumen.getRow(n);
    fila.getCell(1).value = { text: h.cliente, hyperlink: `#${ref}!A1` };
    fila.getCell(1).font = { color: { argb: 'FF0B5E54' }, underline: true };
    fila.getCell(2).value = { formula: `SUMIF(${ref}!${COL.debe}:${COL.debe},">0")`, result: h.remitido };
    fila.getCell(3).value = { formula: `SUMIF(${ref}!${COL.haber}:${COL.haber},">0")`, result: h.pagado };
    fila.getCell(4).value = { formula: `B${n}-C${n}`, result: h.remitido - h.pagado };
    fila.getCell(5).value = {
      formula: `COUNTIF(${ref}!${COL.estado}:${COL.estado},"PENDIENTE")+COUNTIF(${ref}!${COL.estado}:${COL.estado},"ABONADA")`,
      result: h.sinPagar,
    };
  });
  if (hojas.length === 0) resumen.getRow(3).getCell(1).value = 'No hay remisiones vigentes para mostrar.';

  for (let n = 2; n <= Math.max(3, hojas.length + 2); n += 1) {
    for (const c of [2, 3, 4]) {
      resumen.getRow(n).getCell(c).numFmt = MONEDA;
    }
    for (const c of [2, 3, 4, 5]) resumen.getRow(n).getCell(c).alignment = { horizontal: 'right' };
  }
  // El saldo se pinta según su signo, igual que en las hojas de cliente
  resumen.addConditionalFormatting({
    ref: `D2:D${LIMITE}`,
    rules: [
      regla('AND(ISNUMBER($D2),$D2>0)', { texto: ROJO.texto }),
      regla('AND(ISNUMBER($D2),$D2<=0)', { texto: VERDE.texto }),
    ],
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
