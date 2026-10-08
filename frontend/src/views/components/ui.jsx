import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';

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

/** Tarjeta con título y contador (meta) sobre el contenido de una lista */
export function Panel({ title, meta, fill = true, children }) {
  return (
    <section className={`${styles.panel} ${fill ? styles.panelFill : ''}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{title}</h2>
        <span className={styles.panelMeta}>{meta}</span>
      </div>
      {children}
    </section>
  );
}

/** Caja de búsqueda con lupa de las barras de filtros */
export function SearchField({ value, onChange, placeholder, label, className, autoFocus = false }) {
  return (
    <label className={className ?? styles.caseSearch}>
      <Icon name="search" size={17} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
      />
    </label>
  );
}

export function ErrorBanner({ children, onRetry }) {
  return (
    <div className={styles.errorBanner} role="alert">
      <span>{children}</span>
      <button type="button" className={styles.secondaryBtn} onClick={onRetry}>
        <Icon name="refresh" size={16} /> Reintentar
      </button>
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
