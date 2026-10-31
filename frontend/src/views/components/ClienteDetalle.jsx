import { useMemo, useState } from 'react';
import styles from '../../styles/app.module.css';
import { ESTADOS, normalizeEstado } from '../../constants.js';
import { useResource } from '../../hooks/useResource.js';
import { casesService } from '../../services/cases.service.js';
import { remisionesService } from '../../services/remisiones.service.js';
import { deliverySla, formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import { matchesSearch } from '../../utils/search.js';
import { coverImage } from './CasesTable.jsx';
import { ChipGroup, FilterBar, SearchField } from './filters.jsx';
import { Icon } from './Icon.jsx';
import RemisionDetailModal from './RemisionDetailModal.jsx';
import StatusBadge from './StatusBadge.jsx';
import { contar, EmptyState, ErrorBanner, LoadingState, Panel } from './ui.jsx';

const FILTROS = ['Todos', ...ESTADOS, 'Archivados'];

const iniciales = (nombre = '') =>
  nombre.trim().split(/\s+/).slice(0, 2).map((palabra) => palabra[0]?.toUpperCase() ?? '').join('') || '?';

/** Todos los casos de un cliente en tarjetas, cada una con sus remisiones vigentes */
export default function ClienteDetalle({ cliente, onBack, onOpenCase, showToast, version }) {
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const [remisionAbierta, setRemisionAbierta] = useState(null);

  // Casos activos y archivados + remisiones; se recarga cuando cambian los casos (p. ej. tras editar uno en el panel)
  const { data, loading, error, reload } = useResource(
    async () => {
      const [activos, archivados, remisiones] = await Promise.all([
        casesService.list('', false),
        casesService.list('', true),
        remisionesService.list(),
      ]);
      const casos = [...activos, ...archivados].filter((caso) => caso.cliente?.id === cliente.id);
      const porCaso = new Map();
      remisiones
        .filter((rem) => !rem.anulada && rem.caso?.cliente?.id === cliente.id)
        .forEach((rem) => porCaso.set(rem.caso.id, [...(porCaso.get(rem.caso.id) ?? []), rem]));
      return { casos, porCaso };
    },
    [cliente.id, version],
    { casos: [], porCaso: new Map() },
  );
  const { casos, porCaso } = data;

  const totalRemisiones = useMemo(() => [...porCaso.values()].reduce((n, lista) => n + lista.length, 0), [porCaso]);
  const totalRemitido = useMemo(
    () => [...porCaso.values()].flat().reduce((suma, rem) => suma + Number(rem.total ?? 0), 0),
    [porCaso],
  );

  const filtrados = useMemo(
    () =>
      casos.filter((caso) =>
        (filtro === 'Todos' ? !caso.archivado : filtro === 'Archivados' ? caso.archivado : !caso.archivado && normalizeEstado(caso.estado) === filtro) &&
        matchesSearch(query, [caso.codigo, caso.pacienteNombre, caso.doctorNombre]),
      ),
    [casos, filtro, query],
  );

  return (
    <>
      <Panel
        title={(
          <span className={styles.clienteTitle}>
            <button type="button" className={styles.iconBtn} onClick={onBack} aria-label="Volver a clientes">
              <Icon name="back" size={18} />
            </button>
            {cliente.nombre}
          </span>
        )}
        meta={contar(filtrados.length, 'caso', 'casos', loading)}
      >
        <div className={styles.caseBody}>
          <div className={styles.clienteHeader}>
            <div className={styles.clienteAvatar} aria-hidden="true">{iniciales(cliente.nombre)}</div>
            <div className={styles.clienteStats}>
              <div className={styles.clienteStat}>
                <span className={styles.clienteStatValue}>{loading ? '…' : casos.length}</span>
                <span className={styles.clienteStatLabel}>Casos</span>
              </div>
              <div className={styles.clienteStat}>
                <span className={styles.clienteStatValue}>{loading ? '…' : totalRemisiones}</span>
                <span className={styles.clienteStatLabel}>Remisiones</span>
              </div>
              <div className={styles.clienteStat}>
                <span className={styles.clienteStatValue}>{loading ? '…' : formatMoney(totalRemitido)}</span>
                <span className={styles.clienteStatLabel}>Total remitido</span>
              </div>
            </div>
          </div>

          <FilterBar>
            <SearchField value={query} onChange={setQuery} placeholder="Buscar código, paciente o doctor" label="Buscar casos del cliente" />
          </FilterBar>
          <ChipGroup options={FILTROS} value={filtro} onChange={setFiltro} label="Filtrar casos por estado" />

          {error && <ErrorBanner onRetry={reload}>{error}</ErrorBanner>}
          {loading && casos.length === 0 && !error && <LoadingState>Cargando casos…</LoadingState>}
          {!loading && !error && filtrados.length === 0 && (
            <EmptyState title={casos.length ? 'No hay casos para estos filtros' : 'Este cliente aún no tiene casos'}>
              {casos.length ? 'Cambia la búsqueda o el estado.' : 'Se le asignan al registrar un caso.'}
            </EmptyState>
          )}

          {filtrados.length > 0 && (
            <div className={styles.caseGrid}>
              {filtrados.map((caso) => {
                const image = coverImage(caso);
                const sla = deliverySla(caso.fechaEntregaEstimada);
                const remisiones = porCaso.get(caso.id) ?? [];
                const lab = caso.estado === 'En laboratorio';
                return (
                  <article key={caso.id} className={styles.caseCard}>
                    <button type="button" className={styles.caseCardMain} onClick={() => onOpenCase(caso)}>
                      <div className={styles.caseImage}>
                        {image ? (
                          <img src={image} alt={`Imagen del caso ${caso.codigo}`} loading="lazy" />
                        ) : (
                          <div className={`${styles.caseImagePlaceholder} ${lab ? styles.caseImagePlaceholderLab : styles.caseImagePlaceholderTest}`}>
                            <Icon name={lab ? 'box' : 'flask'} size={28} />
                            <span>{lab ? 'En laboratorio' : 'Sin imagen'}</span>
                          </div>
                        )}
                        <span className={`${styles.caseImageBadge} ${lab ? styles.caseImageBadgeLab : styles.caseImageBadgeTest}`}>{caso.codigo}</span>
                      </div>
                      <div className={styles.caseCardBody}>
                        <div className={styles.caseCardMeta}>
                          <StatusBadge estado={caso.estado} />
                          {caso.archivado && <span className={styles.archivedTag}>Archivado</span>}
                        </div>
                        <h3 className={styles.caseCardTitle}>Orden de trabajo: {caso.codigo}</h3>
                        <p className={styles.caseCardClient}><span className={styles.caseCardLabel}>Paciente</span> {caso.pacienteNombre || '—'}</p>
                        <p className={styles.caseCardClient}><span className={styles.caseCardLabel}>Doctor</span> {caso.doctorNombre || '—'}</p>
                        <div className={styles.caseDelivery}>
                          <span><span className={styles.caseCardLabel}>Próxima entrega</span> {caso.fechaEntregaEstimada ? formatEstimatedDate(caso.fechaEntregaEstimada) : '—'}</span>
                          {sla && <span className={`${styles.slaBadge} ${styles[`sla${sla.status}`]}`}>{sla.label}</span>}
                        </div>
                      </div>
                    </button>

                    <div className={styles.caseCardRemisiones}>
                      <div className={styles.caseCardRemisionesTitle}>
                        <Icon name="receipt" size={15} /> Remisiones de este caso ({remisiones.length})
                      </div>
                      {remisiones.length === 0 ? (
                        <p className={styles.caseCardRemisionesEmpty}>Sin remisiones</p>
                      ) : (
                        <ul>
                          {remisiones.map((rem) => (
                            <li key={rem.id}>
                              <button
                                type="button"
                                className={styles.remisionRow}
                                onClick={() => setRemisionAbierta(rem)}
                                aria-label={`Ver remisión N° ${formatRemisionNumber(rem)}`}
                              >
                                <span className={styles.remisionRowNumero}>N° {formatRemisionNumber(rem)}</span>
                                <span className={styles.remisionRowFecha}>{formatEstimatedDate(rem.fecha)}</span>
                                <span className={styles.remisionRowTotal}>{formatMoney(rem.total)}</span>
                                <span className={styles.remisionRowChevron}><Icon name="chevronRight" size={16} /></span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Panel>

      {remisionAbierta && (
        <RemisionDetailModal remision={remisionAbierta} onClose={() => setRemisionAbierta(null)} onVerCaso={onOpenCase} showToast={showToast} />
      )}
    </>
  );
}
