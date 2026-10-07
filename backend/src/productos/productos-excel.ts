import ExcelJS from 'exceljs';

export interface FilaProducto {
  codigo: number;
  categoria: string;
  descripcion: string;
  valor: number;
  activo?: boolean;
}

const norm = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Excel con la lista de precios, en el mismo formato que acepta la importación */
export async function exportarProductos(productos: FilaProducto[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Lista de precios');
  ws.columns = [
    { header: 'Código', key: 'codigo', width: 10 },
    { header: 'Categoría', key: 'categoria', width: 30 },
    { header: 'Descripción', key: 'descripcion', width: 60 },
    { header: 'Valor', key: 'valor', width: 14, style: { numFmt: '#,##0' } },
    { header: 'Activo', key: 'activo', width: 10 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  productos.forEach((p) => ws.addRow({ ...p, activo: p.activo === false ? 'No' : 'Sí' }));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export interface ResultadoLectura {
  filas: FilaProducto[];
  omitidas: { fila: number; motivo: string }[];
}

const aTexto = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return String(v.result ?? '');
    if ('text' in v) return String(v.text);
  }
  return String(v);
};

const aNumero = (v: ExcelJS.CellValue): number | null => {
  const t = aTexto(v).replace(/[$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Lee un .xlsx buscando la fila de encabezados (Código, Categoría, Descripción, Valor/Precio) en las primeras 15 filas */
export async function leerProductos(buffer: Buffer): Promise<ResultadoLectura> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new Error('No se pudo leer el archivo. Debe ser un Excel (.xlsx).');
  }

  for (const ws of wb.worksheets) {
    for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
      const cols: Record<string, number> = {};
      ws.getRow(r).eachCell((cell, c) => {
        const h = norm(aTexto(cell.value));
        if (/^cod/.test(h)) cols.codigo ??= c;
        else if (/^categor/.test(h)) cols.categoria ??= c;
        else if (/^descrip|^producto|^servicio/.test(h)) cols.descripcion ??= c;
        else if (/^valor|^precio/.test(h)) cols.valor ??= c;
        else if (/^activo/.test(h)) cols.activo ??= c;
      });
      if (cols.codigo && cols.descripcion && cols.valor) {
        const filas: FilaProducto[] = [];
        const omitidas: { fila: number; motivo: string }[] = [];
        let categoriaActual = '';
        for (let i = r + 1; i <= ws.rowCount; i++) {
          const row = ws.getRow(i);
          const codigo = aNumero(row.getCell(cols.codigo).value);
          const descripcion = aTexto(row.getCell(cols.descripcion).value).trim();
          const valor = aNumero(row.getCell(cols.valor).value);
          const categoria = cols.categoria ? aTexto(row.getCell(cols.categoria).value).trim() : '';
          if (categoria) categoriaActual = categoria; // celdas combinadas / categoría escrita una sola vez
          if (codigo === null && !descripcion && valor === null) continue; // fila vacía
          if (codigo === null || !Number.isInteger(codigo) || codigo < 1) {
            omitidas.push({ fila: i, motivo: 'código no válido' });
          } else if (!descripcion) {
            omitidas.push({ fila: i, motivo: 'sin descripción' });
          } else if (valor === null || valor < 0 || !Number.isInteger(Math.round(valor)) || valor > 100_000_000) {
            omitidas.push({ fila: i, motivo: 'valor no válido' });
          } else {
            const activoTxt = cols.activo ? norm(aTexto(row.getCell(cols.activo).value)) : '';
            filas.push({
              codigo,
              categoria: categoria || categoriaActual || 'Sin categoría',
              descripcion,
              valor: Math.round(valor),
              ...(activoTxt ? { activo: !['no', 'false', '0', 'inactivo'].includes(activoTxt) } : {}),
            });
          }
        }
        return { filas, omitidas };
      }
    }
  }
  throw new Error('No encontré los encabezados. La primera fila debe tener: Código, Categoría, Descripción y Valor.');
}
