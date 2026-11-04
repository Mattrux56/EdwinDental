import { Fragment } from 'react';
import styles from '../../styles/app.module.css';
import { EmptyState, ErrorBanner, LoadingState } from './ui.jsx';

const alinear = (align) => (align ? { textAlign: align } : undefined);

/** Ancho mínimo que necesitan las columnas fijas más un hueco razonable por cada columna flexible */
const ANCHO_FLEXIBLE = 140;
function anchoMinimo(columns) {
  let total = 0;
  for (const col of columns) {
    const px = typeof col.width === 'number' ? col.width : Number.parseInt(col.width, 10);
    total += Number.isFinite(px) && String(col.width).indexOf('%') === -1 ? px : ANCHO_FLEXIBLE;
  }
  return total;
}

const px = (valor) => (typeof valor === 'number' ? `${valor}px` : valor);

/**
 * Tabla de datos con sus estados: error (con «Reintentar»), cargando y vacía.
 * Las columnas tienen un ancho fijo (table-layout: fixed): no cambian de posición ni de ancho al filtrar.
 *
 * columns: [{ key, header, render(row) → contenido, width, align: 'right', wrap, className, headerProps }]
 *   `width`: px (número o '120px') o '%'; sin ancho, la columna se reparte el espacio que sobra.
 *   `align: 'right'` además usa dígitos de ancho uniforme (para cifras).
 *   `wrap: true`: el texto largo baja hasta 2 líneas; por defecto se corta con «…» (y se ve completo al pasar el cursor).
 *   `header` puede ser texto o un nodo (p. ej. un botón para ordenar); `headerProps` va al <th> (title, aria-sort…).
 * rows: filas ya filtradas · rowKey(row) (por defecto row.id)
 * onRowClick(row): la fila se abre con clic, Enter o espacio · rowLabel(row): texto para lectores de pantalla
 * empty: { title, children } cuando no hay filas (la tabla conserva su encabezado y muestra una fila a todo el ancho)
 * variant 'mini' para tablas dentro de modales · footer: filas del <tfoot>
 * groupKey(row): con filas ya ordenadas, intercala una barra cada vez que cambia el valor (renderGroup(row) = su contenido)
 */
export default function DataTable({
  columns,
  rows,
  rowKey = (row) => row.id,
  onRowClick,
  rowLabel,
  rowClassName,
  loading = false,
  loadingText = 'Cargando…',
  error,
  onRetry,
  empty,
  variant = 'default',
  footer,
  groupKey,
  renderGroup,
}) {
  if (error) return <ErrorBanner onRetry={onRetry}>{error}</ErrorBanner>;

  const mini = variant === 'mini';
  const vacia = rows.length === 0;
  const celdaVacia = loading
    ? <LoadingState>{loadingText}</LoadingState>
    : <EmptyState title={(empty ?? { title: 'Sin resultados' }).title}>{empty?.children}</EmptyState>;

  return (
    <div className={mini ? styles.detailTableWrap : styles.tableWrap}>
      <table className={mini ? styles.miniTable : styles.table} style={{ minWidth: anchoMinimo(columns) }}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={col.width ? { width: px(col.width) } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={alinear(col.align)} {...col.headerProps}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vacia && (
            <tr className={styles.emptyRow}>
              <td colSpan={columns.length} className={styles.emptyCell}>{celdaVacia}</td>
            </tr>
          )}
          {rows.map((row, index) => (
            <Fragment key={rowKey(row)}>
              {groupKey && (index === 0 || groupKey(row) !== groupKey(rows[index - 1])) && (
                <tr className={styles.groupRow}>
                  <th colSpan={columns.length} scope="colgroup">{renderGroup ? renderGroup(row) : groupKey(row)}</th>
                </tr>
              )}
              <tr
                className={`${rowClassName?.(row) ?? ''} ${onRowClick ? styles.rowClickable : ''}`}
                onClick={onRowClick && (() => onRowClick(row))}
                onKeyDown={onRowClick && ((event) => {
                  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onRowClick(row);
                  }
                })}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={rowLabel?.(row)}
              >
                {columns.map((col) => {
                  const contenido = col.render(row);
                  const texto = typeof contenido === 'string' || typeof contenido === 'number' ? String(contenido) : undefined;
                  const clases = [col.className, col.align === 'right' && styles.numCell, col.wrap && styles.cellWrap].filter(Boolean).join(' ');
                  return (
                    <td key={col.key} className={clases || undefined} style={alinear(col.align)} title={texto}>{contenido}</td>
                  );
                })}
              </tr>
            </Fragment>
          ))}
        </tbody>
        {footer && !vacia && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}
