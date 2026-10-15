import styles from '../../styles/app.module.css';
import { Icon } from './Icon.jsx';

/** Piezas básicas de las pantallas. Las de filtros están en filters.jsx y la tabla en DataTable.jsx */

/** Encabezado de página: título, subtítulo y (children) las acciones de la derecha */
export function PageHeader({ title, subtitle, children }) {
  return (
    <header className={styles.appHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageSubtitle}>{subtitle}</p>
      </div>
      {children}
    </header>
  );
}

/** Tarjeta con título, contador (meta) y acciones (botones a la derecha) sobre el contenido de una lista */
export function Panel({ title, meta, actions, fill = true, children }) {
  return (
    <section className={`${styles.panel} ${fill ? styles.panelFill : ''}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{title}</h2>
        <div className={styles.headerActions}>
          <span className={styles.panelMeta}>{meta}</span>
          {actions}
        </div>
      </div>
      {children}
    </section>
  );
}

/** «1 cliente» / «3 clientes»; mientras carga, «Cargando…» (para el contador de Panel) */
export const contar = (n, singular, plural, loading = false) => (loading ? 'Cargando…' : `${n} ${n === 1 ? singular : plural}`);

const TONOS = {
  lab: styles.badgeLab,
  proc: styles.badgeProc,
  progress: styles.badgeProgress,
  done: styles.badgeDone,
  repair: styles.badgeRepair,
  return: styles.badgeReturn,
  default: styles.badgeDefault,
};

/** Etiqueta de color: tone = lab | proc | progress | done | repair | return | default */
export function Badge({ tone = 'default', children }) {
  return <span className={`${styles.badge} ${TONOS[tone] ?? TONOS.default}`}>{children}</span>;
}

export function ErrorBanner({ children, onRetry }) {
  return (
    <div className={styles.errorBanner} role="alert">
      <span>{children}</span>
      {onRetry && (
        <button type="button" className={styles.secondaryBtn} onClick={onRetry}>
          <Icon name="refresh" size={16} /> Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>{title}</p>
      <span>{children}</span>
    </div>
  );
}

export function LoadingState({ children }) {
  return (
    <div className={styles.loadingState}>
      <span className={styles.spinner} /> {children}
    </div>
  );
}

/** Paginación: elegir cuántos por página y pasar de página */
export function Pagination({ page, pageCount, pageSize, pageSizes, onPage, onPageSize, label = 'Cantidad por página' }) {
  return (
    <div className={styles.pagination}>
      <label className={styles.pageSizeControl}>
        Mostrar
        <select className={styles.select} value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} aria-label={label}>
          {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        por página
      </label>
      <span className={styles.panelMeta}>Página {page + 1} de {pageCount}</span>
      <div className={styles.paginationButtons}>
        <button type="button" className={styles.secondaryBtn} onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0}>
          Anterior
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => onPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
