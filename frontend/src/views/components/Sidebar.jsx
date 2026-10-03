import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';

const MENU = [
  { id: 'dashboard', label: 'Panel de casos', icon: 'grid' },
  { id: 'nuevo', label: 'Registrar caso', icon: 'plus' },
];

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandLogo}>
          <Icon name="flask" size={22} />
        </div>
        <div className={styles.brandText}>
          <span className={styles.brandName}>LabTrace</span>
          <span className={styles.brandSub}>Trazabilidad de casos</span>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Navegación principal">
        {MENU.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            className={`${styles.navItem} ${active === item.id ? styles.navItemActive : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={active === item.id ? 'page' : undefined}
          >
            <Icon name={item.icon} />
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.avatar}>EL</div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>Empleado</span>
          <span className={styles.userRole}>Laboratorio</span>
        </div>
      </div>
    </aside>
  );
}
