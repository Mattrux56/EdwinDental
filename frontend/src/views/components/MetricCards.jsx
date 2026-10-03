import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';

export default function MetricCards({ stats }) {
  const items = [
    { label: 'Total de casos', value: stats.total, icon: 'layers', tone: styles.metricTotal },
    { label: 'En laboratorio', value: stats.enLaboratorio, icon: 'flask', tone: styles.metricLab },
    { label: 'Finalizados', value: stats.finalizados, icon: 'check', tone: styles.metricDone },
  ];

  return (
    <section className={styles.metrics} aria-label="Métricas">
      {items.map((item) => (
        <div key={item.label} className={styles.metricCard}>
          <div className={`${styles.metricIcon} ${item.tone}`}>
            <Icon name={item.icon} size={22} />
          </div>
          <div>
            <div className={styles.metricValue}>{item.value}</div>
            <div className={styles.metricLabel}>{item.label}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
