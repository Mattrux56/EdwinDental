import { Fragment } from 'react';
import styles from '../../styles/app.module.css';
import { EmptyState, ErrorBanner, LoadingState } from './ui.jsx';

const alinear = (align) => (align ? { textAlign: align } : undefined);

/**
 * Tabla de datos con sus estados: error (con «Reintentar»), cargando y vacía.
 *
 * columns: [{ key, header, render(row) → contenido, align: 'right', className, headerProps }]
 *   `header` puede ser texto o un nodo (p. ej. un botón para ordenar); `headerProps` va al <th> (title, aria-sort…).
 * rows: filas ya filtradas · rowKey(row) (por defecto row.id)
 * onRowClick(row): la fila se abre con clic, Enter o espacio · rowLabel(row): texto para lectores de pantalla
 * empty: { title, children } cuando no hay filas · variant 'mini' para tablas dentro de modales · footer: filas del <tfoot>
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
  if (rows.length === 0) {
    if (loading) return <LoadingState>{loadingText}</LoadingState>;
    return empty ? <EmptyState title={empty.title}>{empty.children}</EmptyState> : null;
  }

  const mini = variant === 'mini';
  return (
    <div className={mini ? styles.detailTableWrap : styles.tableWrap}>
      <table className={mini ? styles.miniTable : styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={alinear(col.align)} {...col.headerProps}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
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
                {columns.map((col) => (
                  <td key={col.key} className={col.className} style={alinear(col.align)}>{col.render(row)}</td>
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}
