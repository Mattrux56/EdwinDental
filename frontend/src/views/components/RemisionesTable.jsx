import { useMemo, useState } from 'react';
import styles from '../dashboard.module.css';
import r from '../remisiones.module.css';
import { formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import { Icon } from './Icon.jsx';
import PrintRemisionButton from './PrintRemisionButton.jsx';
import { EmptyState, ErrorBanner, LoadingState, Panel, SearchField } from './ui.jsx';
import { normalizeSearchText } from '../../utils/search.js';

const TIPOS = { NORMAL: 'Cuentas de cobro', ELECTRONICA: 'Electrónicas' };

const MESES = ['Todo el año', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function RemisionesTable({ remisiones, loading, error, onRetry, onEliminar, onReactivar, onView, anulandoId, showToast, actions }) {
  const [query, setQuery] = useState('');
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(String(hoy.getFullYear()));
  // Las dos series no se mezclan: se ve una a la vez y se cambia con un clic en el encabezado «N°»
  const [tipo, setTipo] = useState('NORMAL');
  const [recientesPrimero, setRecientesPrimero] = useState(true);

  const filtered = useMemo(() => {
    const term = normalizeSearchText(query.trim());
    const lista = remisiones.filter((rem) => {
      if ((rem.tipo === 'ELECTRONICA' ? 'ELECTRONICA' : 'NORMAL') !== tipo) return false;
      const fecha = String(rem.fecha).slice(0, 10);
      const periodoCoincide = !anio || fecha.startsWith(`${anio}-${mes ? String(mes).padStart(2, '0') : ''}`);
      if (!periodoCoincide) return false;
      return !term || [formatRemisionNumber(rem), rem.noOrden, rem.caso?.codigo, rem.caso?.cliente?.nombre, rem.caso?.pacienteNombre].some(
        (v) => normalizeSearchText(v).includes(term),
      );
    });
    const sentido = recientesPrimero ? -1 : 1;
    return lista.sort((a, b) => sentido * (String(a.fecha).localeCompare(String(b.fecha)) || a.numero - b.numero));
  }, [remisiones, query, mes, anio, tipo, recientesPrimero]);

  const empty = !loading && !error && filtered.length === 0;

  return (
    <Panel title="Remisiones emitidas" actions={actions} meta={loading ? 'Cargando…' : `${filtered.length} ${filtered.length === 1 ? 'remisión' : 'remisiones'}`}>
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
        <EmptyState title={remisiones.length === 0 ? 'Aún no hay remisiones' : 'No hay remisiones para esta búsqueda'}>
          {remisiones.length === 0 ? 'Usa “Nueva remisión” para crear la primera.' : (
            <>
              Estás viendo {TIPOS[tipo].toLowerCase()}. Cambia la búsqueda, el periodo o{' '}
              <button type="button" className={styles.linkBtn} onClick={() => setTipo(tipo === 'NORMAL' ? 'ELECTRONICA' : 'NORMAL')}>
                ver {TIPOS[tipo === 'NORMAL' ? 'ELECTRONICA' : 'NORMAL'].toLowerCase()}
              </button>.
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
                <th aria-label="Acciones" />
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
                      {rem.anulada && (
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={(event) => { event.stopPropagation(); onReactivar(rem); }}
                          disabled={anulandoId === rem.id}
                          aria-label={`Reactivar remisión ${formatRemisionNumber(rem)}`}
                        >
                          {anulandoId === rem.id ? 'Reactivando…' : 'Quitar anulación'}
                        </button>
                      )}
                      {rem.anulada && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={(event) => { event.stopPropagation(); onEliminar(rem); }}
                          disabled={anulandoId === rem.id}
                          aria-label={`Eliminar remisión ${formatRemisionNumber(rem)}`}
                        >
                          <Icon name="trash" size={15} /> Eliminar
                        </button>
                      )}
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
