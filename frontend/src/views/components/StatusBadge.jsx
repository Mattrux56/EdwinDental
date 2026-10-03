import styles from '../dashboard.module.css';

const TONES = {
  'En Laboratorio': styles.badgeLab,
  'En Proceso': styles.badgeProc,
  Finalizado: styles.badgeDone,
};

export default function StatusBadge({ estado }) {
  return <span className={`${styles.badge} ${TONES[estado] ?? styles.badgeDefault}`}>{estado}</span>;
}
