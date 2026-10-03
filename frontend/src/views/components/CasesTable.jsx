import styles from '../dashboard.module.css';
import { formatDateTime, lastMovement } from '../../utils/format.js';
import { Icon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function CasesTable({ casos, loading, error, search, onOpen, onRetry }) {
  const isEmpty = !loading && !error && casos.length === 0;

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{search ? 'Resultados de la búsqueda' : 'Casos registrados'}</h2>
        <span className={styles.panelMeta}>
          {loading ? 'Buscando…' : `${casos.length} ${casos.length === 1 ? 'caso' : 'casos'}`}
        </span>
      </div>

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

      {isEmpty && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>
            {search ? `Sin resultados para “${search}”` : 'Aún no hay casos registrados'}
          </p>
          <span>
            {search
              ? 'Prueba con el código, el nombre del cliente, parte del título o el ID del caso.'
              : 'Usa “Registrar caso” para ingresar el primero.'}
          </span>
        </div>
      )}

      {casos.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Caso</th>
                <th>Estado</th>
                <th>Movimientos</th>
                <th>Último movimiento</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {casos.map((caso) => (
                <tr key={caso.id} className={styles.rowClickable} onClick={() => onOpen(caso)}>
                  <td className={styles.codeCell}>{caso.codigo}</td>
                  <td>
                    <div className={styles.clientName}>{caso.cliente?.nombre}</div>
                    {caso.cliente?.documentoIdentidad && (
                      <div className={styles.clientDoc}>{caso.cliente.documentoIdentidad}</div>
                    )}
                  </td>
                  <td className={styles.titleCell}>{caso.titulo}</td>
                  <td>
                    <StatusBadge estado={caso.estado} />
                  </td>
                  <td className={styles.mutedText}>{caso.seguimientos?.length ?? 0}</td>
                  <td className={styles.mutedText}>{formatDateTime(lastMovement(caso))}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.traceBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(caso);
                      }}
                    >
                      <Icon name="route" size={16} /> Trazabilidad
                    </button>
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
