import styles from '../dashboard.module.css';
import { normalizeEstado } from '../../constants.js';

const TONES = {
  'En laboratorio': styles.badgeLab,
  'En prueba': styles.badgeProc,
  Finalizado: styles.badgeDone,
  arreglo: styles.badgeRepair,
};

export default function StatusBadge({ estado }) {
  const estadoVisible = normalizeEstado(estado);
  return <span className={`${styles.badge} ${TONES[estadoVisible] ?? styles.badgeDefault}`}>{estadoVisible}</span>;
}
