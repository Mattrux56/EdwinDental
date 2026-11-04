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

// ------------------------------------------------------------------ Diseño
const FUENTE = 'Calibri';
const MONEDA = '"$ "#,##0';
const FECHA = 'dd/mm/yyyy';
const FILAS_LIBRES = 50;
const NOMBRE_RESUMEN = 'RESUMEN';

/** Fila del encabezado de la tabla y primera fila de datos en cada hoja de cliente (arriba va el bloque de resumen) */
const FILA_ENCABEZADO = 6;
const PRIMERA = FILA_ENCABEZADO + 1;
/** Las sumas del resumen usan un rango amplio (no filas fijas) para que no se rompan al agregar filas */
const LIMITE = 5000;

const C = {
  encabezado: 'FF0B5E54',
  borde: 'FFE1E5E9',
  tarjeta: 'FFF5F8F8',
  tarjetaBorde: 'FFC9D4D3',
  gris: 'FF404040',
  grisSuave: 'FF6B7780',
  verdeFondo: 'FFD8F0DF',
  verdeTexto: 'FF1B5E20',
  amarilloFondo: 'FFFFF1B8',
  amarilloTexto: 'FF7A5B00',
  pendienteFondo: 'FFE8590C',
  filaPendiente: 'FFFFF0E3',
  filaPago: 'FFEEF5FC',
  rojo: 'FFB3261E',
  verde: 'FF17713A',
  enlace: 'FF0B5E54',
} as const;

/** Letras de las columnas de cada hoja de cliente */
const COL = { fecha: 'A', paciente: 'B', orden: 'C', cc: 'D', debe: 'E', haber: 'F', saldo: 'G', estado: 'H' } as const;

// ------------------------------------------------------------------ Utilidades
/** Nombre de hoja válido para Excel: sin \ / ? * [ ] : ni apóstrofes rectos, hasta 31 caracteres y sin repetirse (ni con RESUMEN) */
export function nombreDeHoja(nombre: string, usados: Set<string>): string {
  // El apóstrofe recto se cambia por ’: ExcelJS no lo escapa en los nombres definidos (área de impresión) y Excel no abre el libro
  const base = nombre.replace(/[\\/?*[\]:]/g, ' ').replace(/'/g, '’').replace(/\s+/g, ' ').trim() || 'Cliente';
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

const fechaTexto = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/** Ancho de columna (en caracteres) para que quepan el título y el dato más largo, dentro de un mínimo y un máximo */
function ancho(titulo: string, datos: string[], min: number, max: number, holgura = 3) {
  const masLargo = datos.reduce((m, t) => Math.max(m, t.length), 0);
  return Math.min(max, Math.max(min, titulo.length + 4, masLargo + holgura));
}

const textoMoneda = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`;

type Estilo = { fondo?: string; texto?: string; negrita?: boolean };

let prioridad = 0; // ExcelJS pide una prioridad distinta por regla; la que se crea antes gana en un conflicto
const regla = (formula: string, estilo: Estilo): ExcelJS.ConditionalFormattingRule => ({
  type: 'expression',
  formulae: [formula],
  priority: ++prioridad,
  style: {
    ...(estilo.fondo ? { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: estilo.fondo } } } : {}),
    ...(estilo.texto || estilo.negrita
      ? { font: { ...(estilo.negrita ? { bold: true } : {}), ...(estilo.texto ? { color: { argb: estilo.texto } } : {}) } }
      : {}),
  },
});

/** Rojo y negrita si el saldo es mayor que 0 (hay deuda) y verde si es 0 o menor */
const reglasSaldo = (celda: string): ExcelJS.ConditionalFormattingRule[] => [
  regla(`AND(ISNUMBER(${celda}),${celda}>0)`, { texto: C.rojo, negrita: true }),
  regla(`AND(ISNUMBER(${celda}),${celda}<=0)`, { texto: C.verde, negrita: true }),
];

/** Dibuja el borde exterior de un rango (celdas combinadas incluidas) y le da fondo */
function caja(ws: ExcelJS.Worksheet, desde: [number, number], hasta: [number, number], fondo: string) {
  const lado = { style: 'thin' as const, color: { argb: C.tarjetaBorde } };
  for (let r = desde[0]; r <= hasta[0]; r += 1) {
    for (let c = desde[1]; c <= hasta[1]; c += 1) {
      const celda = ws.getCell(r, c);
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } };
      celda.border = {
        top: r === desde[0] ? lado : undefined,
        bottom: r === hasta[0] ? lado : undefined,
        left: c === desde[1] ? lado : undefined,
        right: c === hasta[1] ? lado : undefined,
      };
    }
  }
}

/** Configuración de página común: carta vertical, una página de ancho, repetir el encabezado y número de página */
function paginaImpresion(ws: ExcelJS.Worksheet, filaEncabezado: number, ultimaFila: number, columnas: string) {
  ws.pageSetup = {
    paperSize: 1 as ExcelJS.PaperSize, // 1 = carta (Letter): ExcelJS no la incluye en su lista de tamaños
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.7, header: 0.3, footer: 0.3 },
    printTitlesRow: `${filaEncabezado}:${filaEncabezado}`,
    printArea: `A1:${columnas}${ultimaFila}`,
  };
  ws.headerFooter.oddFooter = '&L&8&A&C&8Página &P de &N&R&8&D';
}

// ------------------------------------------------------------------ Movimientos
interface Movimiento {
  fecha: Date;
  orden: 0 | 1; // 0 = remisión (REMITIDO), 1 = pago (PAGADO); el mismo día la remisión va antes que su pago
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
  pendientes: number;
}

// ------------------------------------------------------------------ Hoja de cliente
function hojaCliente(wb: ExcelJS.Workbook, nombreHoja: string, cuenta: ClienteCuenta, generadoEn: Date): ResumenHoja {
  const filas = movimientos(cuenta.remisiones);
  const pagosTotales = filas.filter((m) => m.orden === 1).reduce((a, m) => a + m.linea.total, 0);
  const ultimaDato = FILA_ENCABEZADO + filas.length;
  const ultima = ultimaDato + FILAS_LIBRES;

  const ws = wb.addWorksheet(nombreHoja, {
    views: [{ state: 'frozen', ySplit: FILA_ENCABEZADO, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  // Anchos según los datos reales de este cliente
  const etiquetas = filas.map((m) => (m.orden === 0 ? etiquetaRemision(m.linea) : `PAGO REM. N° ${etiquetaRemision(m.linea)}`));
  const mayorMonto = filas.reduce((a, m) => Math.max(a, m.linea.total), 0);
  const mayorSaldo = filas.reduce((a, m) => a + (m.orden === 0 ? m.linea.total : 0), 0);
  const montos = [textoMoneda(mayorMonto), textoMoneda(mayorSaldo)];
  const anchos = {
    fecha: 15, // deja sitio a la flecha del filtro
    paciente: ancho('PACIENTE', filas.map((m) => m.linea.paciente ?? ''), 24, 42),
    orden: ancho('ORDEN', filas.map((m) => m.linea.ordenTrabajo ?? m.linea.noOrden ?? ''), 14, 24),
    cc: ancho('C. DE C.', etiquetas, 14, 28),
    debe: ancho('REMITIDO', montos, 16, 22),
    haber: ancho('PAGADO', montos, 16, 22),
    saldo: ancho('SALDO', montos, 16, 22),
    estado: ancho('ESTADO', ['PENDIENTE'], 14, 16),
  };
  ws.columns = (['fecha', 'paciente', 'orden', 'cc', 'debe', 'haber', 'saldo', 'estado'] as const).map((key) => ({
    key,
    width: anchos[key],
    style: { font: { name: FUENTE, size: 10 } },
  }));

  // --- Título y enlace
  ws.mergeCells('A1:F1');
  const titulo = ws.getCell('A1');
  titulo.value = cuenta.cliente;
  titulo.font = { name: FUENTE, size: 16, bold: true, color: { argb: C.encabezado } };
  titulo.alignment = { vertical: 'middle', horizontal: 'left', shrinkToFit: cuenta.cliente.length > 48 };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:D2');
  const generado = ws.getCell('A2');
  generado.value = `Estado de cuenta · generado el ${fechaTexto(generadoEn)}`;
  generado.font = { name: FUENTE, size: 10, color: { argb: C.grisSuave } };
  generado.alignment = { vertical: 'middle' };
  ws.mergeCells('G2:H2');
  const volver = ws.getCell('G2');
  volver.value = { text: '← Volver al resumen', hyperlink: `#${referencia(NOMBRE_RESUMEN)}!A1` };
  volver.font = { name: FUENTE, size: 10, underline: true, color: { argb: C.enlace } };
  volver.alignment = { vertical: 'middle', horizontal: 'right' };

  // --- Tarjetas de resumen (fórmulas sobre rangos amplios de la tabla)
  const rango = (col: string) => `${col}${PRIMERA}:${col}${LIMITE}`;
  const remitido = filas.reduce((a, m) => a + (m.orden === 0 ? m.linea.total : 0), 0);
  let acum = 0;
  let pendientes = 0;
  for (const m of filas) {
    if (m.orden !== 0) continue;
    acum += m.linea.total;
    if (estadoAcumulado(acum, m.linea.total, pagosTotales) !== 'PAGADA') pendientes += 1;
  }
  const tarjetas: { desde: string; hasta: string; etiqueta: string; formula: string; result: number; moneda: boolean }[] = [
    { desde: 'A', hasta: 'B', etiqueta: 'TOTAL REMITIDO', formula: `SUM(${rango(COL.debe)})`, result: remitido, moneda: true },
    { desde: 'C', hasta: 'D', etiqueta: 'TOTAL PAGADO', formula: `SUM(${rango(COL.haber)})`, result: pagosTotales, moneda: true },
    { desde: 'E', hasta: 'F', etiqueta: 'SALDO POR COBRAR', formula: 'A4-C4', result: remitido - pagosTotales, moneda: true },
    {
      desde: 'G',
      hasta: 'H',
      etiqueta: 'REMISIONES PENDIENTES',
      formula: `COUNTIF(${rango(COL.estado)},"PENDIENTE")+COUNTIF(${rango(COL.estado)},"ABONADA")`,
      result: pendientes,
      moneda: false,
    },
  ];
  for (const t of tarjetas) {
    ws.mergeCells(`${t.desde}3:${t.hasta}3`);
    ws.mergeCells(`${t.desde}4:${t.hasta}4`);
    const etiqueta = ws.getCell(`${t.desde}3`);
    etiqueta.value = t.etiqueta;
    etiqueta.font = { name: FUENTE, size: 9, bold: true, color: { argb: C.grisSuave } };
    etiqueta.alignment = { vertical: 'bottom', horizontal: 'center' };
    const valor = ws.getCell(`${t.desde}4`);
    valor.value = { formula: t.formula, result: t.result };
    valor.font = { name: FUENTE, size: 15, bold: true, color: { argb: C.gris } };
    valor.alignment = { vertical: 'middle', horizontal: 'center' };
    valor.numFmt = t.moneda ? MONEDA : '0';
    caja(ws, [3, ws.getColumn(t.desde).number], [4, ws.getColumn(t.hasta).number], C.tarjeta);
  }
  ws.getRow(3).height = 20;
  ws.getRow(4).height = 32;
  ws.getRow(5).height = 10;
  ws.addConditionalFormatting({ ref: 'E4', rules: reglasSaldo('$E$4') });

  // --- Encabezado de la tabla
  const encabezados = ['FECHA', 'PACIENTE', 'ORDEN', 'C. DE C.', 'REMITIDO', 'PAGADO', 'SALDO', 'ESTADO'];
  const alineacion: ExcelJS.Alignment['horizontal'][] = ['center', 'left', 'center', 'center', 'right', 'right', 'right', 'center'];
  const filaEnc = ws.getRow(FILA_ENCABEZADO);
  filaEnc.height = 24;
  encabezados.forEach((texto, i) => {
    const celda = filaEnc.getCell(i + 1);
    celda.value = texto;
    celda.font = { name: FUENTE, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.encabezado } };
    celda.alignment = { vertical: 'middle', horizontal: alineacion[i], indent: i === 1 ? 1 : 0 };
  });

  // --- Datos y filas libres (mismas fórmulas y formato)
  const borde = { bottom: { style: 'thin' as const, color: { argb: C.borde } } };
  let debeAcum = 0;
  let haberAcum = 0;
  for (let i = 0; i < filas.length + FILAS_LIBRES; i += 1) {
    const n = PRIMERA + i;
    const m = filas[i];
    const fila = ws.getRow(n);
    fila.height = 18;

    if (m) {
      const l = m.linea;
      fila.getCell(COL.fecha).value = m.fecha;
      fila.getCell(COL.paciente).value = l.paciente ?? '';
      fila.getCell(COL.orden).value = l.ordenTrabajo ?? l.noOrden ?? '';
      if (m.orden === 0) {
        // El número de remisión va como número (no como texto): así Excel no marca la celda con el triángulo verde
        fila.getCell(COL.cc).value = l.tipo === 'ELECTRONICA' ? etiquetaRemision(l) : l.numero;
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
    // Acumulado desde la primera fila de datos. INDEX(...) evita el triángulo verde de Excel («omite celdas adyacentes»)
    const acumulado = (col: string) => `SUM(INDEX(${col}:${col},${PRIMERA}):${col}${n})`;
    const pagosTotal = `SUM(INDEX(${COL.haber}:${COL.haber},${PRIMERA}):${COL.haber}$${LIMITE})`;
    fila.getCell(COL.saldo).value = {
      formula: `IF(AND(${COL.debe}${n}="",${COL.haber}${n}=""),"",${acumulado(COL.debe)}-${acumulado(COL.haber)})`,
      result: vacia ? '' : debeAcum - haberAcum,
    };
    fila.getCell(COL.estado).value = {
      formula:
        `IF(${COL.debe}${n}="","",IF(${pagosTotal}>=${acumulado(COL.debe)},"PAGADA",` +
        `IF(${pagosTotal}>${acumulado(COL.debe)}-${COL.debe}${n},"ABONADA","PENDIENTE")))`,
      result: esDebe ? estadoAcumulado(debeAcum, m.linea.total, pagosTotales) : '',
    };

    // Formato fijo de la fila (los colores de estado van como formato condicional)
    (['fecha', 'paciente', 'orden', 'cc', 'debe', 'haber', 'saldo', 'estado'] as const).forEach((key, k) => {
      const celda = fila.getCell(COL[key]);
      celda.font = { name: FUENTE, size: 10, ...(key === 'estado' ? { bold: true } : {}), ...(key === 'saldo' ? { color: { argb: C.gris } } : {}) };
      celda.alignment = {
        vertical: 'middle',
        horizontal: alineacion[k],
        indent: key === 'paciente' ? 1 : 0,
        // Un nombre más largo que la columna se reduce en vez de cortarse
        shrinkToFit: key === 'paciente' && String(celda.value ?? '').length > anchos.paciente - 2,
      };
      celda.border = borde;
      if (key === 'fecha') celda.numFmt = FECHA;
      if (key === 'cc') celda.numFmt = '0';
      if (key === 'debe' || key === 'haber' || key === 'saldo') celda.numFmt = MONEDA;
    });
  }

  // Solo la columna FECHA tiene filtro (para ver un rango de fechas, un mes o un año)
  ws.autoFilter = { from: { row: FILA_ENCABEZADO, column: 1 }, to: { row: ultima, column: 1 } };

  // --- Colores con formato condicional (se recalculan al editar). La regla creada antes tiene prioridad.
  ws.addConditionalFormatting({
    ref: `${COL.estado}${PRIMERA}:${COL.estado}${ultima}`,
    rules: [
      regla(`$${COL.estado}${PRIMERA}="PENDIENTE"`, { fondo: C.pendienteFondo, texto: 'FFFFFFFF', negrita: true }),
      regla(`$${COL.estado}${PRIMERA}="ABONADA"`, { fondo: C.amarilloFondo, texto: C.amarilloTexto }),
      regla(`$${COL.estado}${PRIMERA}="PAGADA"`, { fondo: C.verdeFondo, texto: C.verdeTexto }),
    ],
  });
  ws.addConditionalFormatting({
    ref: `A${PRIMERA}:H${ultima}`,
    rules: [
      regla(`$${COL.estado}${PRIMERA}="PENDIENTE"`, { fondo: C.filaPendiente }),
      regla(`$${COL.haber}${PRIMERA}<>""`, { fondo: C.filaPago }),
    ],
  });

  paginaImpresion(ws, FILA_ENCABEZADO, ultimaDato + 5, 'H');
  return { hoja: nombreHoja, cliente: cuenta.cliente, remitido: debeAcum, pagado: haberAcum, pendientes };
}

// ------------------------------------------------------------------ Libro
/**
 * Excel de las cuentas de estado: hoja RESUMEN al inicio y una hoja por cliente.
 * Todo lo calculado (SALDO, ESTADO, tarjetas y totales) son fórmulas, así que se actualiza al editar el archivo.
 */
export async function generarCuentasExcel(clientes: ClienteCuenta[], generadoEn: Date = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.calcProperties = { fullCalcOnLoad: true }; // Excel recalcula todo al abrir (los valores guardados son solo de respaldo)
  wb.creator = 'LabTrace';
  wb.created = generadoEn;
  const resumen = wb.addWorksheet(NOMBRE_RESUMEN, {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });
  const usados = new Set<string>([NOMBRE_RESUMEN.toLowerCase(), 'history']);

  const conRemisiones = clientes.filter((c) => c.remisiones.length > 0);
  const hojas = conRemisiones.map((cuenta) => hojaCliente(wb, nombreDeHoja(cuenta.cliente, usados), cuenta, generadoEn));
  // Clientes con más saldo por cobrar primero
  hojas.sort((a, b) => b.remitido - b.pagado - (a.remitido - a.pagado) || a.cliente.localeCompare(b.cliente, 'es'));

  const fuente = { font: { name: FUENTE, size: 10 } };
  const anchoCliente = ancho('CLIENTE', [...hojas.map((h) => h.cliente), 'TOTAL GENERAL'], 34, 60);
  resumen.columns = [
    { key: 'cliente', width: anchoCliente, style: fuente },
    { key: 'remitido', width: 20, style: fuente },
    { key: 'pagado', width: 20, style: fuente },
    { key: 'saldo', width: 20, style: fuente },
    { key: 'pendientes', width: 18, style: fuente },
  ];

  resumen.mergeCells('A1:E1');
  const titulo = resumen.getCell('A1');
  titulo.value = 'Resumen de cuentas de estado';
  titulo.font = { name: FUENTE, size: 16, bold: true, color: { argb: C.encabezado } };
  titulo.alignment = { vertical: 'middle' };
  resumen.getRow(1).height = 28;
  resumen.mergeCells('A2:E2');
  const generado = resumen.getCell('A2');
  generado.value = `Generado el ${fechaTexto(generadoEn)}`;
  generado.font = { name: FUENTE, size: 10, color: { argb: C.grisSuave } };
  resumen.getRow(3).height = 8;

  const encabezados = ['CLIENTE', 'TOTAL REMITIDO', 'TOTAL PAGADO', 'SALDO POR COBRAR', 'REM. PENDIENTES'];
  const filaEnc = resumen.getRow(4);
  filaEnc.height = 24;
  encabezados.forEach((texto, i) => {
    const celda = filaEnc.getCell(i + 1);
    celda.value = texto;
    celda.font = { name: FUENTE, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.encabezado } };
    celda.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right', indent: i === 0 ? 1 : 0 };
  });

  const borde = { bottom: { style: 'thin' as const, color: { argb: C.borde } } };
  const primera = 5;
  hojas.forEach((h, i) => {
    const n = primera + i;
    const ref = referencia(h.hoja);
    const fila = resumen.getRow(n);
    fila.height = 18;
    fila.getCell(1).value = { text: h.cliente, hyperlink: `#${ref}!A1` };
    fila.getCell(1).font = { name: FUENTE, size: 10, underline: true, color: { argb: C.enlace } };
    fila.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1, shrinkToFit: h.cliente.length > anchoCliente - 3 };
    fila.getCell(2).value = { formula: `SUMIF(${ref}!$${COL.debe}$${PRIMERA}:$${COL.debe}$${LIMITE},">0")`, result: h.remitido };
    fila.getCell(3).value = { formula: `SUMIF(${ref}!$${COL.haber}$${PRIMERA}:$${COL.haber}$${LIMITE},">0")`, result: h.pagado };
    fila.getCell(4).value = { formula: `B${n}-C${n}`, result: h.remitido - h.pagado };
    fila.getCell(5).value = {
      formula: `COUNTIF(${ref}!$${COL.estado}$${PRIMERA}:$${COL.estado}$${LIMITE},"PENDIENTE")+COUNTIF(${ref}!$${COL.estado}$${PRIMERA}:$${COL.estado}$${LIMITE},"ABONADA")`,
      result: h.pendientes,
    };
    for (let c = 1; c <= 5; c += 1) {
      const celda = fila.getCell(c);
      celda.border = borde;
      if (c >= 2) {
        celda.alignment = { vertical: 'middle', horizontal: 'right' };
        celda.font = { name: FUENTE, size: 10, ...(c === 4 ? { bold: true } : {}) };
      }
      if (c >= 2 && c <= 4) celda.numFmt = MONEDA;
    }
  });

  let ultima = primera + hojas.length - 1;
  if (hojas.length === 0) {
    resumen.getRow(primera).getCell(1).value = 'No hay remisiones vigentes para mostrar.';
    resumen.getRow(primera).getCell(1).font = { name: FUENTE, size: 10, italic: true, color: { argb: C.grisSuave } };
  } else {
    const t = ultima + 1;
    const total = resumen.getRow(t);
    total.height = 22;
    total.getCell(1).value = 'TOTAL GENERAL';
    const suma = (col: string, valor: number) => ({ formula: `SUM(${col}${primera}:${col}${t - 1})`, result: valor });
    total.getCell(2).value = suma('B', hojas.reduce((a, h) => a + h.remitido, 0));
    total.getCell(3).value = suma('C', hojas.reduce((a, h) => a + h.pagado, 0));
    total.getCell(4).value = suma('D', hojas.reduce((a, h) => a + h.remitido - h.pagado, 0));
    total.getCell(5).value = suma('E', hojas.reduce((a, h) => a + h.pendientes, 0));
    for (let c = 1; c <= 5; c += 1) {
      const celda = total.getCell(c);
      celda.font = { name: FUENTE, size: 11, bold: true };
      celda.border = { top: { style: 'medium', color: { argb: C.gris } } };
      celda.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right', indent: c === 1 ? 1 : 0 };
      if (c >= 2 && c <= 4) celda.numFmt = MONEDA;
    }
    ultima = t;
  }
  // El saldo por cobrar se pinta según su signo: rojo si hay deuda, verde si no
  resumen.addConditionalFormatting({ ref: `D${primera}:D${Math.max(ultima, primera)}`, rules: reglasSaldo(`$D${primera}`) });

  paginaImpresion(resumen, 4, Math.max(ultima, primera) + 1, 'E');
  return Buffer.from(await wb.xlsx.writeBuffer());
}
