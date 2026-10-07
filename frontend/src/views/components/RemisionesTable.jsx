import { useMemo, useState } from 'react';
import styles from '../dashboard.module.css';
import r from '../remisiones.module.css';
import { formatEstimatedDate, formatMoney } from '../../utils/format.js';
import { downloadRemisionExcel } from '../../services/remisiones.service.js';
import { Icon } from './Icon.jsx';

const normalize = (text) =>
  String(text ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function RemisionesTable({ remisiones, loading, error, onRetry, onAnular, onReactivar, onView, onEdit, anulandoId, showToast }) {
  const [query, setQuery] = useState('');
  const [descargandoId, setDescargandoId] = useState(null);

  const descargar = async (rem) => {
    setDescargandoId(rem.id);
    try {
      await downloadRemisionExcel(rem.id, rem.numero);
    } catch (reason) {
      showToast?.('error', reason.message);
    } finally {
      setDescargandoId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return remisiones;
    return remisiones.filter((rem) =>
      [rem.numero, rem.noOrden, rem.caso?.codigo, rem.caso?.titulo, rem.caso?.cliente?.nombre, rem.caso?.pacienteNombre].some(
        (v) => normalize(v).includes(term),
      ),
    );
  }, [remisiones, query]);

  const empty = !loading && !error && filtered.length === 0;

  return (
    <section className={`${styles.panel} ${styles.panelFill}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Remisiones emitidas</h2>
        <span className={styles.panelMeta}>
          {loading ? 'Cargando…' : `${filtered.length} ${filtered.length === 1 ? 'remisión' : 'remisiones'}`}
        </span>
      </div>

      <div className={styles.caseToolbar}>
        <label className={styles.caseSearch}>
          <Icon name="search" size={17} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, caso, cliente o paciente"
            aria-label="Buscar remisiones"
          />
        </label>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>
            {error}
            {/relation|table|does not exist|Prisma/i.test(error) && ' (¿ya ejecutaste el SQL de la base de datos?)'}
          </span>
          <button type="button" className={styles.secondaryBtn} onClick={onRetry}>
            <Icon name="refresh" size={16} /> Reintentar
          </button>
        </div>
      )}

      {loading && remisiones.length === 0 && !error && (
        <div className={styles.loadingState}>
          <span className={styles.spinner} /> Cargando remisiones…
        </div>
      )}

      {empty && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>
            {remisiones.length === 0 ? 'Aún no hay remisiones' : 'No hay remisiones para esta búsqueda'}
          </p>
          <span>
            {remisiones.length === 0 ? 'Usa “Nueva remisión” para crear la primera.' : 'Cambia el texto de búsqueda.'}
          </span>
        </div>
      )}

      {filtered.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Caso</th>
                <th>Cliente / Paciente</th>
                <th>Productos</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((rem) => (
                <tr key={rem.id} className={rem.anulada ? r.cancelledRow : undefined}>
                  <td className={r.numberCell}>
                    <button type="button" className={styles.linkBtn} onClick={() => onView(rem)} title="Ver detalle">{rem.numero}</button>
                    {rem.anulada && <span className={r.cancelledBadge}>Anulada</span>}
                  </td>
                  <td className={styles.mutedText}>{formatEstimatedDate(rem.fecha)}</td>
                  <td>
                    <div className={styles.codeCell}>{rem.caso?.codigo}</div>
                    <div className={styles.clientDoc}>{rem.caso?.titulo}</div>
                  </td>
                  <td>
                    <div className={styles.clientName}>{rem.caso?.cliente?.nombre}</div>
                    <div className={styles.clientDoc}>{rem.caso?.pacienteNombre || '—'}</div>
                  </td>
                  <td className={styles.mutedText}>{rem.items.length}</td>
                  <td className={r.moneyCell}>{formatMoney(rem.total)}</td>
                  <td>
                    <div className={r.rowActions}>
                      <button type="button" className={styles.secondaryBtn} onClick={() => onView(rem)}>
                        <Icon name="eye" size={15} /> Ver
                      </button>
                      <button type="button" className={styles.traceBtn} onClick={() => descargar(rem)} disabled={descargandoId === rem.id}>
                        <Icon name="download" size={15} /> {descargandoId === rem.id ? '…' : 'Excel'}
                      </button>
                      {!rem.anulada && (
                        <button type="button" className={styles.secondaryBtn} onClick={() => onEdit(rem)}>
                          <Icon name="edit" size={15} /> Corregir
                        </button>
                      )}
                      {rem.anulada && (
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => onReactivar(rem)}
                          disabled={anulandoId === rem.id}
                          aria-label={`Reactivar remisión ${rem.numero}`}
                        >
                          {anulandoId === rem.id ? 'Reactivando…' : 'Quitar anulación'}
                        </button>
                      )}
                      {!rem.anulada && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => onAnular(rem)}
                          disabled={anulandoId === rem.id}
                          aria-label={`Anular remisión ${rem.numero}`}
                        >
                          {anulandoId === rem.id ? 'Anulando…' : 'Anular'}
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
    </section>
  );
}
