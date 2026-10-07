import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';

const MENU = [
  { id: 'resumen', label: 'Resumen de casos', icon: 'grid' },
  { id: 'casos', label: 'Panel de casos', icon: 'layers' },
  { id: 'alertas', label: 'Alertas de entrega', icon: 'bell' },
  { id: 'remisiones', label: 'Remisiones', icon: 'receipt' },
  { id: 'cuentas', label: 'Cuentas de cobro', icon: 'wallet' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'productos', label: 'Productos', icon: 'box' },
];

export default function Sidebar({ active, onNavigate, alertCount = 0 }) {
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
            {item.id === 'alertas' && alertCount > 0 && (
              <span className={styles.navBadge} aria-label={`${alertCount} alertas`}>{alertCount}</span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
}
