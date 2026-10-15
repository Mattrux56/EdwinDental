import styles from '../styles/app.module.css';
import { useResource } from '../hooks/useResource.js';
import { casesService } from '../services/cases.service.js';
import { formatEstimatedDate } from '../utils/format.js';
import DataTable from './components/DataTable.jsx';
import { Icon } from './components/Icon.jsx';
import StatusBadge from './components/StatusBadge.jsx';
import { Panel } from './components/ui.jsx';

const NIVEL = {
  vencido: { label: (d) => `Vencido hace ${Math.abs(d)} ${Math.abs(d) === 1 ? 'día' : 'días'}`, cls: 'slaoverdue' },
  hoy: { label: () => 'Entrega hoy', cls: 'sladueSoon' },
  proximo: { label: (d) => `Vence en ${d} ${d === 1 ? 'día' : 'días'}`, cls: 'sladueSoon' },
};

const COLUMNAS = [
  {
    key: 'situacion',
    header: 'Situación',
    render: (a) => <span className={`${styles.slaBadge} ${styles[NIVEL[a.nivel].cls]}`}>{NIVEL[a.nivel].label(a.dias)}</span>,
  },
  {
    key: 'caso',
    header: 'Caso',
    render: (a) => (
      <>
        <div className={styles.codeCell}>{a.codigo}</div>
        <div className={styles.clientDoc}>Orden de trabajo</div>
      </>
    ),
  },
  {
    key: 'cliente',
    header: 'Cliente / Paciente',
    render: (a) => (
      <>
        <div className={styles.clientName}>{a.cliente?.nombre}</div>
        <div className={styles.clientDoc}>{a.pacienteNombre || '—'}</div>
      </>
    ),
  },
  { key: 'estado', header: 'Estado', render: (a) => <StatusBadge estado={a.estado} /> },
  { key: 'entrega', header: 'Entrega', className: styles.mutedText, render: (a) => formatEstimatedDate(a.fechaEntregaEstimada) },
];

/** Casos sin finalizar con la entrega vencida, para hoy o en los próximos 3 días */
export default function AlertasView({ casos, onOpen }) {
  // Se recarga al entrar y cuando cambia la lista de casos (p. ej. al editar una fecha o finalizar un caso)
  const { data: alertas, loading, error, reload } = useResource(() => casesService.alertas(), [casos]);

  const conteo = (nivel) => alertas.filter((a) => a.nivel === nivel).length;

  return (
    <Panel
      title="Alertas de entrega"
      actions={(
        <button type="button" className={styles.secondaryBtn} onClick={reload} disabled={loading}>
          <Icon name="refresh" size={16} /> Actualizar
        </button>
      )}
      meta={loading ? 'Cargando…' : `${conteo('vencido')} vencidos · ${conteo('hoy')} para hoy · ${conteo('proximo')} próximos`}
    >
      <DataTable
        columns={COLUMNAS}
        rows={alertas}
        onRowClick={onOpen}
        rowLabel={(a) => `Abrir caso ${a.codigo}`}
        loading={loading}
        loadingText="Cargando alertas…"
        error={error}
        onRetry={reload}
        empty={{ title: 'Todo al día', children: 'No hay casos vencidos ni por vencer en los próximos días.' }}
      />
    </Panel>
  );
}
