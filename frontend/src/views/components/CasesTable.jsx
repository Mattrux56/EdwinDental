import { useMemo, useState } from 'react';
import styles from '../../styles/app.module.css';
import { deliverySla, formatDateTime, formatEstimatedDate, lastMovement } from '../../utils/format.js';
import { ESTADOS, normalizeEstado } from '../../constants.js';
import { matchesSearch } from '../../utils/search.js';
import { ChipGroup, DateFilter, FilterBar, SearchField } from './filters.jsx';
import { Icon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';
import { contar, EmptyState, ErrorBanner, LoadingState, Pagination, Panel } from './ui.jsx';

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
  actions,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [desde, setDesde] = useState('');
  const [pageSize, setPageSize] = useState(9);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return casos.filter((caso) =>
      (filter === 'Todos' || normalizeEstado(caso.estado) === filter) &&
      (!desde || ingresoDate(caso) >= desde) &&
      matchesSearch(query, [caso.codigo, caso.doctorNombre, caso.cliente?.nombre, caso.pacienteNombre]),
    );
  }, [casos, desde, filter, query]);

  const pageCount = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const shown = compact ? casos.slice(0, 3) : filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const empty = !loading && !error && shown.length === 0;

  // Cualquier cambio de filtro vuelve a la primera página
  const conPagina = (setter) => (value) => {
    setter(value);
    setPage(0);
  };

  const remove = (event, caso) => {
    event.stopPropagation();
    onDelete(caso);
  };

  return (
    <Panel
      title={compact ? 'Últimos casos registrados' : verArchivados ? 'Casos archivados' : 'Casos registrados'}
      meta={contar(compact ? shown.length : filtered.length, 'caso', 'casos', loading)}
      fill={!compact}
      actions={actions}
    >

      <div className={styles.caseBody}>
      {!compact && (
        <>
          <FilterBar>
            <SearchField
              value={query}
              onChange={conPagina(setQuery)}
              placeholder="Buscar código, caso, cliente o paciente"
              label="Buscar casos"
            />
            {onToggleArchivados && (verArchivados || archivadosCount > 0) && (
              <button type="button" className={styles.secondaryBtn} onClick={onToggleArchivados}>
                <Icon name="archive" size={15} /> {verArchivados ? 'Volver a los casos activos' : `Ver archivados (${archivadosCount})`}
              </button>
            )}
            <DateFilter label="Desde" value={desde} onChange={conPagina(setDesde)} ariaLabel="Filtrar desde fecha" />
          </FilterBar>
          <ChipGroup options={FILTERS} value={filter} onChange={conPagina(setFilter)} label="Filtrar casos por estado" />
        </>
      )}

      {error && <ErrorBanner onRetry={onRetry}>{error}</ErrorBanner>}

      {loading && casos.length === 0 && !error && <LoadingState>Cargando casos…</LoadingState>}

      {empty && (
        <EmptyState
          title={casos.length === 0 ? (verArchivados ? 'No hay casos archivados' : 'Aún no hay casos registrados') : 'No hay casos para estos filtros'}
        >
          {casos.length === 0
            ? 'Usa “Registrar caso” para ingresar el primero.'
            : 'Cambia la búsqueda, el estado o el rango de fechas.'}
        </EmptyState>
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
                      <div className={`${styles.caseImagePlaceholder} ${caso.estado === 'En laboratorio' ? styles.caseImagePlaceholderLab : styles.caseImagePlaceholderTest}`}>
                        <Icon name={caso.estado === 'En laboratorio' ? 'box' : 'flask'} size={28} />
                        <span>{caso.estado === 'En laboratorio' ? 'En laboratorio' : 'Sin imagen'}</span>
                      </div>
                    )}
                    <span className={`${styles.caseImageBadge} ${caso.estado === 'En laboratorio' ? styles.caseImageBadgeLab : styles.caseImageBadgeTest}`}>{caso.codigo}</span>
                  </div>
                  <div className={styles.caseCardBody}>
                    <div className={styles.caseCardMeta}>
                      <StatusBadge estado={caso.estado} />
                      <span className={styles.caseDate}>{formatDateTime(lastMovement(caso))}</span>
                    </div>
                    <h3 className={styles.caseCardTitle}>Orden de trabajo: {caso.codigo}</h3>
                    <p className={styles.caseCardClient}><span className={styles.caseCardLabel}>Cliente</span> {caso.cliente?.nombre}</p>
                    <p className={styles.caseCardClient}><span className={styles.caseCardLabel}>Doctor</span> {caso.doctorNombre || '—'}</p>
                    <p className={styles.caseCardClient}><span className={styles.caseCardLabel}>Paciente</span> {caso.pacienteNombre || '—'}</p>
                    <div className={styles.caseDelivery}>
                      <span><span className={styles.caseCardLabel}>Próxima entrega</span> {caso.fechaEntregaEstimada ? formatEstimatedDate(caso.fechaEntregaEstimada) : '—'}</span>
                      {sla && (
                        <span className={`${styles.slaBadge} ${styles[`sla${sla.status}`]}`}>
                          {sla.label}
                        </span>
                      )}
                    </div>
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
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          pageSizes={PAGE_SIZES}
          onPage={setPage}
          onPageSize={conPagina(setPageSize)}
          label="Cantidad de casos por página"
        />
      )}
    </Panel>
  );
}
