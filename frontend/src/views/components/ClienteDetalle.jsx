import { useMemo, useState } from 'react';
import styles from '../../styles/app.module.css';
import ds from '../../styles/ds.module.css';
import { ESTADOS, normalizeEstado } from '../../constants.js';
import { useResource } from '../../hooks/useResource.js';
import { casesService } from '../../services/cases.service.js';
import { remisionesService } from '../../services/remisiones.service.js';
import { deliverySla, enPeriodo, formatEstimatedDate, formatMoney, formatRemisionNumber, ingresoDate } from '../../utils/format.js';
import { matchesSearch } from '../../utils/search.js';
import { coverImage } from './CasesTable.jsx';
import { Field, Segmented, Tabs } from './controls.jsx';
import { FilterBar, MESES, MonthFilter, SearchField, SelectFilter } from './filters.jsx';
import { Icon } from './Icon.jsx';
import RemisionDetailModal from './RemisionDetailModal.jsx';
import StatusBadge from './StatusBadge.jsx';
import { contar, EmptyState, ErrorBanner, LoadingState, PagoBadge, Panel } from './ui.jsx';

const VISTAS = ['Casos', 'Estado de cuenta'];

const etiquetaPago = (rem) => (rem.pagada ? 'Pagada' : 'Pendiente');

const iniciales = (nombre = '') =>
  nombre.trim().split(/\s+/).slice(0, 2).map((palabra) => palabra[0]?.toUpperCase() ?? '').join('') || '?';

/** Todos los casos de un cliente en tarjetas, cada una con sus remisiones vigentes */
export default function ClienteDetalle({ cliente, onBack, onOpenCase, showToast, version }) {
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const [remisionAbierta, setRemisionAbierta] = useState(null);
  const [vista, setVista] = useState('Casos');
  const [periodo, setPeriodo] = useState(null); // null = todos los meses
  const [estadoPago, setEstadoPago] = useState('Todos');

  // Casos activos y archivados + remisiones; se recarga cuando cambian los casos (p. ej. tras editar uno en el panel)
  const { data, loading, error, reload } = useResource(
    async () => {
      // El servidor filtra por cliente: ya no se bajan todos los casos y remisiones del laboratorio
      const [activos, archivados, remisiones] = await Promise.all([
        casesService.list({ clienteId: cliente.id }),
        casesService.list({ clienteId: cliente.id, archivados: true }),
        remisionesService.list({ clienteId: cliente.id }),
      ]);
      const casos = [...activos, ...archivados];
      const porCaso = new Map();
      const vigentes = remisiones.filter((rem) => !rem.anulada);
      vigentes.forEach((rem) => porCaso.set(rem.caso.id, [...(porCaso.get(rem.caso.id) ?? []), rem]));
      return { casos, porCaso, vigentes };
    },
    [cliente.id, version],
    { casos: [], porCaso: new Map(), vigentes: [] },
  );
  const { casos, porCaso, vigentes } = data;

  // Casos del mes elegido (o todos): de aquí salen el contador de la cabecera y los filtros de estado
  const casosDelPeriodo = useMemo(() => casos.filter((caso) => enPeriodo(ingresoDate(caso), periodo)), [casos, periodo]);
  const activosDelPeriodo = useMemo(() => casosDelPeriodo.filter((caso) => !caso.archivado), [casosDelPeriodo]);

  const filtrados = useMemo(
    () =>
      casosDelPeriodo.filter((caso) =>
        (filtro === 'Todos' ? !caso.archivado : filtro === 'Archivados' ? caso.archivado : !caso.archivado && normalizeEstado(caso.estado) === filtro) &&
        matchesSearch(query, [caso.codigo, caso.pacienteNombre, caso.doctorNombre]),
      ),
    [casosDelPeriodo, filtro, query],
  );

  const verCuenta = vista === 'Estado de cuenta';
  // Remisiones del mes elegido (o todas): de aquí salen los totales de la cabecera y la lista
  const delPeriodo = useMemo(() => {
    return vigentes.filter((rem) => enPeriodo(rem.fecha, periodo));
  }, [vigentes, periodo]);
  // Remisiones de cada tarjeta: solo las del mes elegido, para que cuadren con la cabecera
  const porCasoPeriodo = useMemo(() => {
    const mapa = new Map();
    delPeriodo.forEach((rem) => mapa.set(rem.caso.id, [...(mapa.get(rem.caso.id) ?? []), rem]));
    return mapa;
  }, [delPeriodo]);
  const totalRemitido = useMemo(() => delPeriodo.reduce((suma, rem) => suma + Number(rem.total ?? 0), 0), [delPeriodo]);
  const totalPendiente = useMemo(
    () => delPeriodo.filter((rem) => !rem.pagada).reduce((suma, rem) => suma + Number(rem.total ?? 0), 0),
    [delPeriodo],
  );
  // Una cuenta de estado es cliente + mes: pagada si todas sus remisiones lo están, pendiente si ninguna, parcial en otro caso
  const estadoPorMes = useMemo(() => {
    const grupos = new Map();
    delPeriodo.forEach((rem) => {
      const mes = String(rem.fecha).slice(0, 7);
      const g = grupos.get(mes) ?? { total: 0, pagadas: 0 };
      g.total += 1;
      if (rem.pagada) g.pagadas += 1;
      grupos.set(mes, g);
    });
    return new Map([...grupos].map(([mes, g]) => [mes, g.pagadas === g.total ? 'Pagada' : g.pagadas === 0 ? 'Pendiente' : 'Pago parcial']));
  }, [delPeriodo]);
  const sufijoPeriodo = periodo ? ` · ${MESES[periodo.mes - 1].toLowerCase()} ${periodo.anio}` : '';
  const remisionesFiltradas = useMemo(() => {
    return delPeriodo
      .filter((rem) =>
        (estadoPago === 'Todos' || (estadoPago === 'Pagada' ? rem.pagada : estadoPago === 'Pendiente' ? !rem.pagada : estadoPorMes.get(String(rem.fecha).slice(0, 7)) === 'Pago parcial')) &&
        matchesSearch(query, [formatRemisionNumber(rem), rem.noOrden, rem.caso?.codigo, rem.pacienteNombre ?? rem.caso?.pacienteNombre, rem.doctorNombre ?? rem.caso?.doctorNombre]))
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.numero - a.numero);
  }, [delPeriodo, query, estadoPago, estadoPorMes]);

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
        meta={verCuenta ? contar(remisionesFiltradas.length, 'remisión', 'remisiones', loading) : contar(filtrados.length, 'caso', 'casos', loading)}
      >
        <div className={styles.caseBody}>
          <div className={styles.clienteHeader}>
            <div className={styles.clienteAvatar} aria-hidden="true">{iniciales(cliente.nombre)}</div>
            <div className={styles.clienteStats}>
              <div className={styles.clienteStat}>
                <span className={styles.clienteStatValue}>{loading ? '…' : activosDelPeriodo.length}</span>
                <span className={styles.clienteStatLabel}>Casos activos{sufijoPeriodo}</span>
              </div>
              <div className={styles.clienteStat}>
                <span className={styles.clienteStatValue}>{loading ? '…' : delPeriodo.length}</span>
                <span className={styles.clienteStatLabel}>Remisiones{sufijoPeriodo}</span>
              </div>
              <div className={styles.clienteStat}>
                <span className={styles.clienteStatValue}>{loading ? '…' : formatMoney(totalRemitido)}</span>
                <span className={styles.clienteStatLabel}>Total remitido{sufijoPeriodo}</span>
              </div>
              <div className={styles.clienteStat}>
                <span className={styles.clienteStatValue}>{loading ? '…' : formatMoney(totalPendiente)}</span>
                <span className={styles.clienteStatLabel}>Pendiente a cobrar{sufijoPeriodo}</span>
              </div>
            </div>
          </div>

          <Tabs
            label="Secciones del cliente"
            value={vista}
            onChange={(v) => { setVista(v); setQuery(''); setEstadoPago('Todos'); }}
            tabs={[
              { value: 'Casos', label: `Casos (${activosDelPeriodo.length})`, icon: 'layers' },
              { value: 'Estado de cuenta', label: `Estado de cuenta (${delPeriodo.length})`, icon: 'wallet' },
            ]}
          />

          <div className={ds.toolbar}>
            <SearchField className={`${styles.caseSearch} ${ds.toolbarGrow}`} value={query} onChange={setQuery} placeholder={verCuenta ? 'Buscar por número, orden o paciente' : 'Buscar por código, paciente o doctor'} label={verCuenta ? 'Buscar en el estado de cuenta del cliente' : 'Buscar casos del cliente'} />
            <Field label="Mes">
              <MonthFilter periodo={periodo} onChange={setPeriodo} />
            </Field>
            {verCuenta ? (
              <Field label="Estado de pago">
                <Segmented
                  label="Filtrar por estado de pago"
                  value={estadoPago}
                  onChange={setEstadoPago}
                  options={[
                    { value: 'Todos', label: 'Todas', count: delPeriodo.length },
                    { value: 'Pendiente', label: 'Pendientes', count: delPeriodo.filter((r) => !r.pagada).length },
                    { value: 'Pago parcial', label: 'Pago parcial', count: delPeriodo.filter((r) => estadoPorMes.get(String(r.fecha).slice(0, 7)) === 'Pago parcial').length },
                    { value: 'Pagada', label: 'Pagadas', count: delPeriodo.filter((r) => r.pagada).length },
                  ]}
                />
              </Field>
            ) : (
              <>
                <Field label="Estado del caso">
                  <SelectFilter value={filtro === 'Archivados' ? 'Todos' : filtro} onChange={setFiltro} options={['Todos', ...ESTADOS].map((f) => ({ value: f, label: f === 'Todos' ? 'Todos los estados' : f }))} label="Filtrar casos por estado" />
                </Field>
                <Field label="Ver">
                  <Segmented
                    label="Casos activos o archivados"
                    value={filtro === 'Archivados' ? 'archivados' : 'activos'}
                    onChange={(v) => setFiltro(v === 'archivados' ? 'Archivados' : 'Todos')}
                    options={[
                      { value: 'activos', label: 'Activos', count: activosDelPeriodo.length },
                      { value: 'archivados', label: 'Archivados', count: casosDelPeriodo.length - activosDelPeriodo.length },
                    ]}
                  />
                </Field>
              </>
            )}
          </div>

          {verCuenta && (
            <>
              {error && <ErrorBanner onRetry={reload}>{error}</ErrorBanner>}
              {loading && vigentes.length === 0 && !error && <LoadingState>Cargando estado de cuenta…</LoadingState>}
              {!loading && !error && remisionesFiltradas.length === 0 && (
                <EmptyState title={vigentes.length ? 'No hay remisiones para estos filtros' : 'Este cliente aún no tiene remisiones'}>
                  {vigentes.length ? 'Cambia la búsqueda, el mes o el estado de pago.' : 'Se crean desde la sección Remisiones.'}
                </EmptyState>
              )}
              {remisionesFiltradas.length > 0 && (
                <ul className={styles.clienteRemisiones}>
                  {remisionesFiltradas.map((rem) => (
                    <li key={rem.id}>
                      <button type="button" className={styles.remisionRow} onClick={() => setRemisionAbierta(rem)} aria-label={`Ver remisión N° ${formatRemisionNumber(rem)}, ${etiquetaPago(rem).toLowerCase()}`}>
                        <span className={styles.remisionRowNumero}>N° {formatRemisionNumber(rem)}</span>
                        <span className={styles.remisionRowFecha}>{formatEstimatedDate(rem.fecha)}</span>
                        <span className={styles.remisionRowFecha}>Orden {rem.caso?.codigo}</span>
                        <PagoBadge estado={etiquetaPago(rem)} />
                        <span className={styles.remisionRowTotal}>{formatMoney(rem.total)}</span>
                        <span className={styles.remisionRowChevron}><Icon name="chevronRight" size={16} /></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {!verCuenta && error && <ErrorBanner onRetry={reload}>{error}</ErrorBanner>}
          {!verCuenta && loading && casos.length === 0 && !error && <LoadingState>Cargando casos…</LoadingState>}
          {!verCuenta && !loading && !error && filtrados.length === 0 && (
            <EmptyState title={casos.length ? 'No hay casos para estos filtros' : 'Este cliente aún no tiene casos'}>
              {casos.length ? 'Cambia la búsqueda, el mes o el estado.' : 'Se le asignan al registrar un caso.'}
            </EmptyState>
          )}

          {!verCuenta && filtrados.length > 0 && (
            <div className={styles.caseGrid}>
              {filtrados.map((caso) => {
                const image = coverImage(caso);
                const sla = deliverySla(caso.fechaEntregaEstimada, caso.estado);
                const remisiones = porCasoPeriodo.get(caso.id) ?? [];
                const lab = normalizeEstado(caso.estado) === 'En laboratorio';
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
                                aria-label={`Ver remisión N° ${formatRemisionNumber(rem)}, ${etiquetaPago(rem).toLowerCase()}`}
                              >
                                <span className={styles.remisionRowNumero}>N° {formatRemisionNumber(rem)}</span>
                                <span className={styles.remisionRowFecha}>{formatEstimatedDate(rem.fecha)}</span>
                                <PagoBadge estado={etiquetaPago(rem)} />
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
