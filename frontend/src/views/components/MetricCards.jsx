import styles from '../../styles/app.module.css';
import { Icon } from './Icon.jsx';

export default function MetricCards({ stats, onSelect }) {
  const items = [
    { label: 'Total de casos', value: stats.total, icon: 'layers', tone: styles.metricTotal, estado: 'Todos' },
    { label: 'En laboratorio', value: stats.enLaboratorio, icon: 'flask', tone: styles.metricLab, estado: 'En laboratorio' },
    { label: 'En prueba', value: stats.enPrueba, icon: 'vial', tone: styles.metricTest, estado: 'En prueba' },
    { label: 'Finalizados', value: stats.finalizados, icon: 'check', tone: styles.metricDone, estado: 'Finalizado' },
    { label: 'En arreglo', value: stats.arreglos, icon: 'refresh', tone: styles.metricTotal, estado: 'arreglo' },
    { label: 'En devolución', value: stats.devoluciones, icon: 'undo', tone: styles.metricReturn, estado: 'Devolución' },
  ];

  return (
    <section className={styles.metrics} aria-label="Métricas">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={styles.metricCard}
          onClick={() => onSelect?.(item.estado)}
          title={`Ver los casos: ${item.label.toLowerCase()}`}
        >
          <div className={`${styles.metricIcon} ${item.tone}`}>
            <Icon name={item.icon} size={22} />
          </div>
          <div>
            <div className={styles.metricValue}>{item.value}</div>
            <div className={styles.metricLabel}>{item.label}</div>
          </div>
        </button>
      ))}
    </section>
  );
}
