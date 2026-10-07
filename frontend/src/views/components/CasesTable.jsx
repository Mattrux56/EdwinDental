import { useMemo, useState } from 'react';
import styles from '../dashboard.module.css';
import { deliverySla, formatDateTime, formatEstimatedDate, lastMovement } from '../../utils/format.js';
import { Icon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';
import { ESTADOS, normalizeEstado } from '../../constants.js';

const FILTERS = ['Todos', ...ESTADOS];
const PAGE_SIZES = [9, 18, 36];

function coverImage(caso) {
  return caso.seguimientos?.flatMap((movimiento) => movimiento.imagenes ?? [])[0]?.urlImagen;
}

function ingresoDate(caso) {
  if (caso.fechaIngreso) return String(caso.fechaIngreso).slice(0, 10);
  const date = new Date(caso.creadoEn);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CasesTable({
  casos,
  loading,
  error,
  onOpen,
  onRetry,
  onDelete,
  deletingId,
  onArchive,
  verArchivados = false,
  onToggleArchivados,
  archivadosCount = 0,
  compact = false,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [desde, setDesde] = useState('');
  const [pageSize, setPageSize] = useState(9);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return casos.filter((caso) => {
      if (filter !== 'Todos' && normalizeEstado(caso.estado) !== filter) return false;
      const fecha = ingresoDate(caso);
      if (desde && fecha < desde) return false;
      if (!term) return true;
      return [caso.codigo, caso.titulo, caso.cliente?.nombre, caso.pacienteNombre]
        .some((valor) => valor?.toLocaleLowerCase('es').includes(term));
    });
  }, [casos, desde, filter, query]);

  const pageCount = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const shown = compact ? casos.slice(0, 3) : filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const empty = !loading && !error && shown.length === 0;

  const remove = (event, caso) => {
    event.stopPropagation();
    onDelete(caso);
  };

  return (
    <section className={`${styles.panel} ${compact ? '' : styles.panelFill}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          {compact ? 'Últimos casos registrados' : verArchivados ? 'Casos archivados' : 'Casos registrados'}
        </h2>
        <span className={styles.panelMeta}>
          {loading ? 'Cargando…' : `${compact ? shown.length : filtered.length} ${
            (compact ? shown.length : filtered.length) === 1 ? 'caso' : 'casos'
          }`}
        </span>
      </div>

      <div className={styles.caseBody}>
      {!compact && (
        <>
          <div className={styles.caseToolbar}>
            <label className={styles.caseSearch}>
              <Icon name="search" size={17} />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Buscar código, caso, cliente o paciente"
                aria-label="Buscar casos"
              />
            </label>
            {onToggleArchivados && (verArchivados || archivadosCount > 0) && (
              <button type="button" className={styles.secondaryBtn} onClick={onToggleArchivados}>
                <Icon name="archive" size={15} /> {verArchivados ? 'Volver a los casos activos' : `Ver archivados (${archivadosCount})`}
              </button>
            )}
            <label className={styles.dateFilter}>
              <span>Desde</span>
              <input
                type="date"
                value={desde}
                onChange={(event) => {
                  setDesde(event.target.value);
                  setPage(0);
                }}
                aria-label="Filtrar desde fecha"
              />
            </label>
          </div>
          <div className={styles.tableFilters} role="group" aria-label="Filtrar casos por estado">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.filterBtn} ${filter === item ? styles.filterBtnActive : ''}`}
                onClick={() => {
                  setFilter(item);
                  setPage(0);
                }}
                aria-pressed={filter === item}
              >
                {item}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button type="button" className={styles.secondaryBtn} onClick={onRetry}>
            <Icon name="refresh" size={16} /> Reintentar
          </button>
        </div>
      )}

      {loading && casos.length === 0 && !error && (
        <div className={styles.loadingState}>
          <span className={styles.spinner} /> Cargando casos…
        </div>
      )}

      {empty && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>
            {casos.length === 0 ? (verArchivados ? 'No hay casos archivados' : 'Aún no hay casos registrados') : 'No hay casos para estos filtros'}
          </p>
          <span>
            {casos.length === 0
              ? 'Usa “Registrar caso” para ingresar el primero.'
              : 'Cambia la búsqueda, el estado o el rango de fechas.'}
          </span>
        </div>
      )}

      {shown.length > 0 && (
        <div className={styles.caseGrid}>
          {shown.map((caso) => {
            const image = coverImage(caso);
            const sla = deliverySla(caso.fechaEntregaEstimada);
            return (
              <article key={caso.id} className={styles.caseCard}>
                <button type="button" className={styles.caseCardMain} onClick={() => onOpen(caso)}>
                  <div className={styles.caseImage}>
                    {image ? (
                      <img src={image} alt={`Imagen del caso ${caso.codigo}`} loading="lazy" />
                    ) : (
                      <div className={styles.caseImagePlaceholder}>
                        <Icon name="flask" size={28} />
                        <span>Sin imagen</span>
                      </div>
                    )}
                    <span className={styles.caseImageBadge}>{caso.codigo}</span>
                  </div>
                  <div className={styles.caseCardBody}>
                    <div className={styles.caseCardMeta}>
                      <StatusBadge estado={caso.estado} />
                      <span className={styles.caseDate}>{formatDateTime(lastMovement(caso))}</span>
                    </div>
                    <h3 className={styles.caseCardTitle}>{caso.titulo}</h3>
                    <p className={styles.caseCardClient}><span className={styles.caseCardLabel}>Cliente</span> {caso.cliente?.nombre}</p>
                    <p className={styles.caseCardClient}><span className={styles.caseCardLabel}>Paciente</span> {caso.pacienteNombre || '—'}</p>
                    {caso.fechaEntregaEstimada && (
                      <div className={styles.caseDelivery}>
                        <span>Entrega: {formatEstimatedDate(caso.fechaEntregaEstimada)}</span>
                        {sla && (
                          <span className={`${styles.slaBadge} ${styles[`sla${sla.status}`]}`}>
                            {sla.label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
                {!compact && (
                  <div className={styles.caseCardActions}>
                    <span>{caso.seguimientos?.length ?? 0} {caso.seguimientos?.length === 1 ? 'movimiento' : 'movimientos'}</span>
                    <div className={styles.cardButtons}>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={(event) => {
                          event.stopPropagation();
                          onArchive(caso, !verArchivados);
                        }}
                        aria-label={`${verArchivados ? 'Restaurar' : 'Archivar'} caso ${caso.codigo}`}
                      >
                        {verArchivados ? 'Restaurar' : 'Archivar'}
                      </button>
                      {verArchivados && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={(event) => remove(event, caso)}
                          disabled={deletingId === caso.id}
                          aria-label={`Eliminar caso ${caso.codigo}`}
                        >
                          {deletingId === caso.id ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      </div>

      {!compact && filtered.length > 0 && (
        <div className={styles.pagination}>
          <label className={styles.pageSizeControl}>
            Mostrar
            <select
              className={styles.select}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
              aria-label="Cantidad de casos por página"
            >
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            por página
          </label>
          <span className={styles.panelMeta}>
            Página {currentPage + 1} de {pageCount}
          </span>
          <div className={styles.paginationButtons}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              Anterior
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))}
              disabled={currentPage >= pageCount - 1}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
