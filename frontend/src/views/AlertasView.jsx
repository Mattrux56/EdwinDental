import { useCallback, useEffect, useState } from 'react';
import styles from './dashboard.module.css';
import { casesService } from '../services/cases.service.js';
import { formatEstimatedDate } from '../utils/format.js';
import { Icon } from './components/Icon.jsx';
import StatusBadge from './components/StatusBadge.jsx';
import { EmptyState, ErrorBanner, PageHeader, Panel } from './components/ui.jsx';

const NIVEL = {
  vencido: { label: (d) => `Vencido hace ${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'}`, cls: 'slaoverdue' },
  hoy: { label: () => 'Entrega hoy', cls: 'sladueSoon' },
  proximo: { label: (d) => `Vence en ${d} ${d === 1 ? 'día' : 'días'}`, cls: 'sladueSoon' },
};

/** Casos sin finalizar con la entrega vencida, para hoy o en los próximos 3 días */
export default function AlertasView({ casos, onOpen }) {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setAlertas(await casesService.alertas());
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Se recarga al entrar y cuando cambia la lista de casos (p. ej. al editar una fecha o finalizar un caso)
  useEffect(() => {
    load();
  }, [load, casos]);

  const conteo = (nivel) => alertas.filter((a) => a.nivel === nivel).length;

  return (
    <>
      <PageHeader title="Alertas de entrega" subtitle="Casos sin finalizar que vencen en los próximos 3 días o ya están atrasados.">
        <button type="button" className={styles.secondaryBtn} onClick={load} disabled={loading}>
          <Icon name="refresh" size={16} /> Actualizar
        </button>
      </PageHeader>

      <Panel
        title="Pendientes de entrega"
        meta={loading ? 'Cargando…' : `${conteo('vencido')} vencidos · ${conteo('hoy')} para hoy · ${conteo('proximo')} próximos`}
      >
        {error && <ErrorBanner onRetry={load}>{error}</ErrorBanner>}
        {!loading && !error && alertas.length === 0 && (
          <EmptyState title="Todo al día">No hay casos vencidos ni por vencer en los próximos días.</EmptyState>
        )}

        {alertas.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Situación</th>
                  <th>Caso</th>
                  <th>Cliente / Paciente</th>
                  <th>Estado</th>
                  <th>Entrega</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((a) => {
                  const nivel = NIVEL[a.nivel];
                  return (
                    <tr key={a.id} className={styles.rowClickable} onClick={() => onOpen(a)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(a)}>
                      <td><span className={`${styles.slaBadge} ${styles[nivel.cls]}`}>{nivel.label(a.dias)}</span></td>
                      <td>
                        <div className={styles.codeCell}>{a.codigo}</div>
                        <div className={styles.clientDoc}>Orden de trabajo</div>
                      </td>
                      <td>
                        <div className={styles.clientName}>{a.cliente?.nombre}</div>
                        <div className={styles.clientDoc}>{a.pacienteNombre || '—'}</div>
                      </td>
                      <td><StatusBadge estado={a.estado} /></td>
                      <td className={styles.mutedText}>{formatEstimatedDate(a.fechaEntregaEstimada)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
