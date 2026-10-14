import { useMemo, useState } from 'react';
import styles from '../dashboard.module.css';
import r from '../remisiones.module.css';
import { formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import PrintRemisionButton from './PrintRemisionButton.jsx';
import { EmptyState, ErrorBanner, LoadingState, Panel, SearchField } from './ui.jsx';
import { normalizeSearchText } from '../../utils/search.js';

const TIPOS = { NORMAL: 'Cuentas de cobro', ELECTRONICA: 'Electrónicas' };

const MESES = ['Todo el año', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function RemisionesTable({ remisiones, loading, error, onRetry, onView, showToast, actions }) {
  const [query, setQuery] = useState('');
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(String(hoy.getFullYear()));
  // Las dos series no se mezclan: se ve una a la vez y se cambia con un clic en el encabezado «N°»
  const [tipo, setTipo] = useState('NORMAL');
  const [recientesPrimero, setRecientesPrimero] = useState(true);
  // Las anuladas se ven aparte, con el botón «Anuladas» del encabezado
  const [verAnuladas, setVerAnuladas] = useState(false);

  const { filtered, totalAnuladas } = useMemo(() => {
    const term = normalizeSearchText(query.trim());
    const coincide = (rem) => {
      if ((rem.tipo === 'ELECTRONICA' ? 'ELECTRONICA' : 'NORMAL') !== tipo) return false;
      const fecha = String(rem.fecha).slice(0, 10);
      const periodoCoincide = !anio || fecha.startsWith(`${anio}-${mes ? String(mes).padStart(2, '0') : ''}`);
      if (!periodoCoincide) return false;
      return !term || [formatRemisionNumber(rem), rem.noOrden, rem.caso?.codigo, rem.caso?.cliente?.nombre, rem.caso?.pacienteNombre].some(
        (v) => normalizeSearchText(v).includes(term),
      );
    };
    const coincidentes = remisiones.filter(coincide);
    const lista = coincidentes.filter((rem) => Boolean(rem.anulada) === verAnuladas);
    const sentido = recientesPrimero ? -1 : 1;
    lista.sort((a, b) => sentido * (String(a.fecha).localeCompare(String(b.fecha)) || a.numero - b.numero));
    return { filtered: lista, totalAnuladas: coincidentes.filter((rem) => rem.anulada).length };
  }, [remisiones, query, mes, anio, tipo, recientesPrimero, verAnuladas]);

  const empty = !loading && !error && filtered.length === 0;
  const contador = verAnuladas
    ? `${filtered.length} ${filtered.length === 1 ? 'anulada' : 'anuladas'}`
    : `${filtered.length} ${filtered.length === 1 ? 'remisión' : 'remisiones'}`;

  return (
    <Panel title={verAnuladas ? 'Remisiones anuladas' : 'Remisiones emitidas'} actions={actions} meta={loading ? 'Cargando…' : contador}>
      <div className={styles.caseToolbar}>
        <SearchField value={query} onChange={setQuery} placeholder="Buscar por número, caso, cliente o paciente" label="Buscar remisiones" />
        <div className={r.periodControl}>
          <select className={styles.select} value={mes} onChange={(event) => setMes(Number(event.target.value))} aria-label="Filtrar por mes">
            {MESES.map((nombre, index) => <option key={nombre} value={index}>{nombre}</option>)}
          </select>
          <input
            className={styles.input}
            type="number"
            min="2000"
            max="2100"
            value={anio}
            onChange={(event) => setAnio(event.target.value)}
            onBlur={() => {
              const value = Number(anio);
              if (!Number.isInteger(value) || value < 2000 || value > 2100) setAnio(String(hoy.getFullYear()));
            }}
            aria-label="Filtrar por año"
          />
        </div>
      </div>

      {error && (
        <ErrorBanner onRetry={onRetry}>
          {error}
          {/relation|table|does not exist|Prisma/i.test(error) && ' (¿ya ejecutaste el SQL de la base de datos?)'}
        </ErrorBanner>
      )}

      {loading && remisiones.length === 0 && !error && <LoadingState>Cargando remisiones…</LoadingState>}

      {empty && (
        <EmptyState
          title={remisiones.length === 0 ? 'Aún no hay remisiones' : verAnuladas ? 'No hay remisiones anuladas para esta búsqueda' : 'No hay remisiones para esta búsqueda'}
        >
          {remisiones.length === 0 ? 'Usa “Nueva remisión” para crear la primera.' : verAnuladas ? (
            <>
              Estás viendo {TIPOS[tipo].toLowerCase()} anuladas. Cambia la búsqueda o el periodo, o{' '}
              <button type="button" className={styles.linkBtn} onClick={() => setVerAnuladas(false)}>
                vuelve a las vigentes
              </button>.
            </>
          ) : (
            <>
              Estás viendo {TIPOS[tipo].toLowerCase()}. Cambia la búsqueda, el periodo o{' '}
              <button type="button" className={styles.linkBtn} onClick={() => setTipo(tipo === 'NORMAL' ? 'ELECTRONICA' : 'NORMAL')}>
                ver {TIPOS[tipo === 'NORMAL' ? 'ELECTRONICA' : 'NORMAL'].toLowerCase()}
              </button>
              {totalAnuladas > 0 && (
                <>
                  {' '}o{' '}
                  <button type="button" className={styles.linkBtn} onClick={() => setVerAnuladas(true)}>
                    ver las anuladas ({totalAnuladas})
                  </button>
                </>
              )}.
            </>
          )}
        </EmptyState>
      )}

      {filtered.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className={r.thBtn}
                    onClick={() => setTipo(tipo === 'NORMAL' ? 'ELECTRONICA' : 'NORMAL')}
                    title={`Viendo ${TIPOS[tipo].toLowerCase()}. Clic para ver ${TIPOS[tipo === 'NORMAL' ? 'ELECTRONICA' : 'NORMAL'].toLowerCase()}`}
                  >
                    N° · {TIPOS[tipo]} <span aria-hidden="true">⇄</span>
                  </button>
                </th>
                <th aria-sort={recientesPrimero ? 'descending' : 'ascending'}>
                  <button
                    type="button"
                    className={r.thBtn}
                    onClick={() => setRecientesPrimero((valor) => !valor)}
                    title={recientesPrimero ? 'Más recientes primero. Clic para ver primero las más antiguas' : 'Más antiguas primero. Clic para ver primero las más recientes'}
                  >
                    Fecha <span aria-hidden="true">{recientesPrimero ? '▼' : '▲'}</span>
                  </button>
                </th>
                <th>Caso</th>
                <th>Cliente / Paciente</th>
                <th>Productos</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th className={r.actionsTh}>
                  <button
                    type="button"
                    className={r.thBtn}
                    onClick={() => setVerAnuladas((valor) => !valor)}
                    aria-pressed={verAnuladas}
                    title={verAnuladas ? 'Volver a las remisiones vigentes' : 'Ver las remisiones anuladas'}
                  >
                    {verAnuladas ? '← Vigentes' : `Anuladas (${totalAnuladas})`}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rem) => (
                <tr
                  key={rem.id}
                  className={`${rem.anulada ? r.cancelledRow : ''} ${styles.rowClickable}`}
                  onClick={() => onView(rem)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      onView(rem);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Ver remisión ${formatRemisionNumber(rem)}`}
                >
                  <td className={r.numberCell}>
                    {formatRemisionNumber(rem)}
                    {rem.anulada && <span className={r.cancelledBadge}>Anulada</span>}
                  </td>
                  <td className={styles.mutedText}>{formatEstimatedDate(rem.fecha)}</td>
                  <td>
                    <div className={styles.codeCell}>{rem.caso?.codigo}</div>
                    <div className={styles.clientDoc}>Orden de trabajo</div>
                  </td>
                  <td>
                    <div className={styles.clientName}>{rem.caso?.cliente?.nombre}</div>
                    <div className={styles.clientDoc}>{rem.caso?.pacienteNombre || '—'}</div>
                  </td>
                  <td className={styles.mutedText}>{rem.items.length}</td>
                  <td className={r.moneyCell}>{formatMoney(rem.total)}</td>
                  <td>
                    <div className={r.rowActions}>
                      <PrintRemisionButton remision={rem} showToast={showToast} className={styles.traceBtn} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
