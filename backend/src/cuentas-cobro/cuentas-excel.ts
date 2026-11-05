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

/** Solo verde (pagado) y naranja/rojo (pendiente), más grises y el verde oscuro de la marca */
const C = {
  encabezado: 'FF0B5E54',
  borde: 'FFE1E5E9',
  tarjeta: 'FFF5F8F8',
  tarjetaBorde: 'FFC9D4D3',
  gris: 'FF404040',
  grisSuave: 'FF6B7780',
  verdeFondo: 'FFD8F0DF',
  verdeTexto: 'FF1B5E20',
  pendienteFondo: 'FFE8590C',
  filaPendiente: 'FFFFF0E3',
  rojo: 'FFB3261E',
  verde: 'FF17713A',
  enlace: 'FF0B5E54',
} as const;

/** Letras de las columnas de cada hoja de cliente: una fila por remisión */
const COL = { fecha: 'A', paciente: 'B', orden: 'C', cc: 'D', valor: 'E', estado: 'F', pago: 'G' } as const;
type Clave = keyof typeof COL;
const CLAVES = ['fecha', 'paciente', 'orden', 'cc', 'valor', 'estado', 'pago'] as const;

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

/** Rojo y negrita si lo que falta por cobrar es mayor que 0 y verde si es 0 */
const reglasPorCobrar = (celda: string): ExcelJS.ConditionalFormattingRule[] => [
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

// ------------------------------------------------------------------ Filas
const etiquetaRemision = (l: LineaCuenta) => (l.tipo === 'ELECTRONICA' ? `FE-${l.numero}` : String(l.numero));

/**
 * Fecha de pago de una remisión: el día en que se marcó pagada. Si está pagada y por alguna razón no tiene fecha,
 * la de la propia remisión. Sin pagar: sin fecha (queda PENDIENTE).
 */
const fechaDePago = (l: LineaCuenta): Date | null => {
  if (!l.pagada) return null;
  return l.pagadaEn ? diaLocal(l.pagadaEn) : soloDia(l.fecha);
};

const ordenadas = (remisiones: LineaCuenta[]) =>
  [...remisiones].sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.numero - b.numero);

interface ResumenHoja {
  hoja: string;
  cliente: string;
  remitido: number;
  pagado: number;
  pendientes: number;
}

// ------------------------------------------------------------------ Hoja de cliente
function hojaCliente(wb: ExcelJS.Workbook, nombreHoja: string, cuenta: ClienteCuenta, generadoEn: Date): ResumenHoja {
  const filas = ordenadas(cuenta.remisiones);
  const ultimaDato = FILA_ENCABEZADO + filas.length;
  const ultima = ultimaDato + FILAS_LIBRES;

  const ws = wb.addWorksheet(nombreHoja, {
    views: [{ state: 'frozen', ySplit: FILA_ENCABEZADO, showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  // Anchos según los datos reales de este cliente
  const anchos: Record<Clave, number> = {
    fecha: 15, // deja sitio a la flecha del filtro
    paciente: ancho('PACIENTE', filas.map((l) => l.paciente ?? ''), 24, 42),
    orden: ancho('ORDEN', filas.map((l) => l.ordenTrabajo ?? l.noOrden ?? ''), 14, 24),
    cc: ancho('C. DE C.', filas.map(etiquetaRemision), 12, 16),
    valor: ancho('VALOR', [textoMoneda(filas.reduce((a, l) => Math.max(a, l.total), 0))], 16, 22),
    estado: 14,
    pago: 18,
  };
  ws.columns = CLAVES.map((key) => ({ key, width: anchos[key], style: { font: { name: FUENTE, size: 10 } } }));

  // --- Título y enlace
  ws.mergeCells('A1:E1');
  const titulo = ws.getCell('A1');
  titulo.value = cuenta.cliente;
  titulo.font = { name: FUENTE, size: 16, bold: true, color: { argb: C.encabezado } };
  titulo.alignment = { vertical: 'middle', horizontal: 'left', shrinkToFit: cuenta.cliente.length > 44 };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:D2');
  const generado = ws.getCell('A2');
  generado.value = `Estado de cuenta · generado el ${fechaTexto(generadoEn)}`;
  generado.font = { name: FUENTE, size: 10, color: { argb: C.grisSuave } };
  generado.alignment = { vertical: 'middle' };
  ws.mergeCells('F2:G2');
  const volver = ws.getCell('F2');
  volver.value = { text: '← Volver al resumen', hyperlink: `#${referencia(NOMBRE_RESUMEN)}!A1` };
  volver.font = { name: FUENTE, size: 10, underline: true, color: { argb: C.enlace } };
  volver.alignment = { vertical: 'middle', horizontal: 'right' };

  // --- Tarjetas de resumen: fórmulas sobre un rango amplio de la tabla (no filas fijas)
  const rango = (col: string) => `${col}${PRIMERA}:${col}${LIMITE}`;
  const remitido = filas.reduce((a, l) => a + l.total, 0);
  const pagado = filas.filter((l) => l.pagada).reduce((a, l) => a + l.total, 0);
  const pendientes = filas.filter((l) => !l.pagada).length;
  const tarjetas = [
    { desde: 'A', hasta: 'B', etiqueta: 'TOTAL REMITIDO', formula: `SUM(${rango(COL.valor)})`, result: remitido, moneda: true },
    { desde: 'C', hasta: 'D', etiqueta: 'TOTAL PAGADO', formula: `SUMIF(${rango(COL.estado)},"PAGADA",${rango(COL.valor)})`, result: pagado, moneda: true },
    { desde: 'E', hasta: 'F', etiqueta: 'POR COBRAR', formula: `SUMIF(${rango(COL.estado)},"PENDIENTE",${rango(COL.valor)})`, result: remitido - pagado, moneda: true },
    { desde: 'G', hasta: 'G', etiqueta: 'REMISIONES PENDIENTES', formula: `COUNTIF(${rango(COL.estado)},"PENDIENTE")`, result: pendientes, moneda: false },
  ];
  for (const t of tarjetas) {
    if (t.desde !== t.hasta) {
      ws.mergeCells(`${t.desde}3:${t.hasta}3`);
      ws.mergeCells(`${t.desde}4:${t.hasta}4`);
    }
    const etiqueta = ws.getCell(`${t.desde}3`);
    etiqueta.value = t.etiqueta;
    etiqueta.font = { name: FUENTE, size: t.desde === t.hasta ? 8 : 9, bold: true, color: { argb: C.grisSuave } };
    etiqueta.alignment = { vertical: 'bottom', horizontal: 'center', wrapText: true };
    const valor = ws.getCell(`${t.desde}4`);
    valor.value = { formula: t.formula, result: t.result };
    valor.font = { name: FUENTE, size: 15, bold: true, color: { argb: C.gris } };
    valor.alignment = { vertical: 'middle', horizontal: 'center' };
    valor.numFmt = t.moneda ? MONEDA : '0';
    caja(ws, [3, ws.getColumn(t.desde).number], [4, ws.getColumn(t.hasta).number], C.tarjeta);
  }
  ws.getRow(3).height = 26;
  ws.getRow(4).height = 32;
  ws.getRow(5).height = 10;
  ws.addConditionalFormatting({ ref: 'E4', rules: reglasPorCobrar('$E$4') });

  // --- Encabezado de la tabla
  const encabezados = ['FECHA', 'PACIENTE', 'ORDEN', 'C. DE C.', 'VALOR', 'ESTADO', 'FECHA DE PAGO'];
  const alineacion: ExcelJS.Alignment['horizontal'][] = ['center', 'left', 'center', 'center', 'right', 'center', 'center'];
  const filaEnc = ws.getRow(FILA_ENCABEZADO);
  filaEnc.height = 24;
  encabezados.forEach((texto, i) => {
    const celda = filaEnc.getCell(i + 1);
    celda.value = texto;
    celda.font = { name: FUENTE, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.encabezado } };
    celda.alignment = { vertical: 'middle', horizontal: alineacion[i], indent: i === 1 ? 1 : 0 };
  });

  // --- Una fila por remisión, más las filas libres (mismas fórmulas, formato y validación)
  const borde = { bottom: { style: 'thin' as const, color: { argb: C.borde } } };
  for (let i = 0; i < filas.length + FILAS_LIBRES; i += 1) {
    const n = PRIMERA + i;
    const l = filas[i];
    const fila = ws.getRow(n);
    fila.height = 18;

    const pago = l ? fechaDePago(l) : null;
    if (l) {
      fila.getCell(COL.fecha).value = soloDia(l.fecha);
      fila.getCell(COL.paciente).value = l.paciente ?? '';
      fila.getCell(COL.orden).value = l.ordenTrabajo ?? l.noOrden ?? '';
      // El número de remisión va como número (no como texto): así Excel no marca la celda con el triángulo verde
      fila.getCell(COL.cc).value = l.tipo === 'ELECTRONICA' ? etiquetaRemision(l) : l.numero;
      fila.getCell(COL.valor).value = l.total;
      if (pago) fila.getCell(COL.pago).value = pago;
    }

    // Al escribir una fecha de pago la fila pasa a PAGADA; al borrarla vuelve a PENDIENTE (vacía si no hay nada en la fila)
    fila.getCell(COL.estado).value = {
      formula: `IF(AND(${COL.valor}${n}="",${COL.pago}${n}=""),"",IF(${COL.pago}${n}<>"","PAGADA","PENDIENTE"))`,
      result: !l ? '' : pago ? 'PAGADA' : 'PENDIENTE',
    };
    fila.getCell(COL.pago).dataValidation = {
      type: 'date',
      operator: 'between',
      allowBlank: true,
      formulae: [new Date(Date.UTC(2000, 0, 1)), new Date(Date.UTC(2100, 11, 31))],
      showInputMessage: true,
      promptTitle: 'Fecha de pago',
      prompt: 'Escribe la fecha de pago (dd/mm/aaaa) para marcarla como PAGADA. Bórrala para volver a PENDIENTE.',
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Fecha no válida',
      error: 'Escribe una fecha (por ejemplo 25/11/2026) o deja la celda vacía.',
    };

    CLAVES.forEach((key, k) => {
      const celda = fila.getCell(COL[key]);
      celda.font = { name: FUENTE, size: 10, ...(key === 'estado' ? { bold: true } : {}) };
      celda.alignment = {
        vertical: 'middle',
        horizontal: alineacion[k],
        indent: key === 'paciente' ? 1 : 0,
        // Un nombre más largo que la columna se reduce en vez de cortarse
        shrinkToFit: key === 'paciente' && String(celda.value ?? '').length > anchos.paciente - 2,
      };
      celda.border = borde;
      if (key === 'fecha' || key === 'pago') celda.numFmt = FECHA;
      if (key === 'cc') celda.numFmt = '0';
      if (key === 'valor') celda.numFmt = MONEDA;
    });
  }

  // Solo la columna FECHA tiene filtro (para ver un rango de fechas, un mes o un año)
  ws.autoFilter = { from: { row: FILA_ENCABEZADO, column: 1 }, to: { row: ultima, column: 1 } };

  // --- Colores con formato condicional (se recalculan al editar). La regla creada antes tiene prioridad.
  ws.addConditionalFormatting({
    ref: `${COL.estado}${PRIMERA}:${COL.estado}${ultima}`,
    rules: [
      regla(`$${COL.estado}${PRIMERA}="PENDIENTE"`, { fondo: C.pendienteFondo, texto: 'FFFFFFFF', negrita: true }),
      regla(`$${COL.estado}${PRIMERA}="PAGADA"`, { fondo: C.verdeFondo, texto: C.verdeTexto, negrita: true }),
    ],
  });
  ws.addConditionalFormatting({
    ref: `A${PRIMERA}:G${ultima}`,
    rules: [regla(`$${COL.estado}${PRIMERA}="PENDIENTE"`, { fondo: C.filaPendiente })],
  });

  paginaImpresion(ws, FILA_ENCABEZADO, ultimaDato + 5, 'G');
  return { hoja: nombreHoja, cliente: cuenta.cliente, remitido, pagado, pendientes };
}

// ------------------------------------------------------------------ Libro
/**
 * Excel de las cuentas de estado: hoja RESUMEN al inicio y una hoja por cliente, con una fila por remisión.
 * ESTADO sale de FECHA DE PAGO y los totales son fórmulas, así que todo se actualiza al editar el archivo.
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
  // Clientes con más por cobrar primero
  hojas.sort((a, b) => b.remitido - b.pagado - (a.remitido - a.pagado) || a.cliente.localeCompare(b.cliente, 'es'));

  const fuente = { font: { name: FUENTE, size: 10 } };
  const anchoCliente = ancho('CLIENTE', [...hojas.map((h) => h.cliente), 'TOTAL GENERAL'], 34, 60);
  resumen.columns = [
    { key: 'cliente', width: anchoCliente, style: fuente },
    { key: 'remitido', width: 20, style: fuente },
    { key: 'pagado', width: 20, style: fuente },
    { key: 'porCobrar', width: 20, style: fuente },
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

  const encabezados = ['CLIENTE', 'TOTAL REMITIDO', 'TOTAL PAGADO', 'POR COBRAR', 'REM. PENDIENTES'];
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
    const rango = (col: string) => `${ref}!$${col}$${PRIMERA}:$${col}$${LIMITE}`;
    const fila = resumen.getRow(n);
    fila.height = 18;
    fila.getCell(1).value = { text: h.cliente, hyperlink: `#${ref}!A1` };
    fila.getCell(1).font = { name: FUENTE, size: 10, underline: true, color: { argb: C.enlace } };
    fila.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1, shrinkToFit: h.cliente.length > anchoCliente - 3 };
    fila.getCell(2).value = { formula: `SUM(${rango(COL.valor)})`, result: h.remitido };
    fila.getCell(3).value = { formula: `SUMIF(${rango(COL.estado)},"PAGADA",${rango(COL.valor)})`, result: h.pagado };
    fila.getCell(4).value = { formula: `SUMIF(${rango(COL.estado)},"PENDIENTE",${rango(COL.valor)})`, result: h.remitido - h.pagado };
    fila.getCell(5).value = { formula: `COUNTIF(${rango(COL.estado)},"PENDIENTE")`, result: h.pendientes };
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
  // Lo que falta por cobrar se pinta según su valor: rojo si es mayor que 0, verde si es 0
  resumen.addConditionalFormatting({ ref: `D${primera}:D${Math.max(ultima, primera)}`, rules: reglasPorCobrar(`$D${primera}`) });

  paginaImpresion(resumen, 4, Math.max(ultima, primera) + 1, 'E');
  return Buffer.from(await wb.xlsx.writeBuffer());
}
