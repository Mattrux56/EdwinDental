import { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '../../styles/app.module.css';
import CambiarBaseModal from './CambiarBaseModal.jsx';
import { Icon } from './Icon.jsx';

const GRUPOS = [
  {
    titulo: 'Casos',
    items: [
      { id: 'resumen', label: 'Resumen', icon: 'grid' },
      { id: 'casos', label: 'Panel de casos', icon: 'layers' },
      { id: 'alertas', label: 'Alertas de entrega', icon: 'bell' },
    ],
  },
  {
    titulo: 'Facturación',
    items: [
      { id: 'remisiones', label: 'Remisiones', icon: 'receipt' },
      { id: 'cuentas', label: 'Cuentas de estado', icon: 'wallet' },
    ],
  },
  {
    titulo: 'Catálogos',
    items: [
      { id: 'clientes', label: 'Clientes', icon: 'users' },
      { id: 'productos', label: 'Productos', icon: 'box' },
    ],
  },
];

export default function Sidebar({ active, onNavigate, alertCount = 0 }) {
  const [cambiandoBase, setCambiandoBase] = useState(false);
  const esEscritorio = Boolean(window.labtraceEscritorio?.configGuardar); // el .env solo existe en la app de escritorio
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
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo} className={styles.navGroup} role="group" aria-label={grupo.titulo}>
            <span className={styles.navGroupTitle}>{grupo.titulo}</span>
            {grupo.items.map((item) => (
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
          </div>
        ))}
      </nav>

      {esEscritorio && (
        <button type="button" title="Cambiar la base de datos a la que se conecta LabTrace" className={`${styles.navItem} ${styles.navItemBottom}`} onClick={() => setCambiandoBase(true)}>
          <Icon name="settings" />
          <span className={styles.navLabel}>Base de datos</span>
        </button>
      )}
      {cambiandoBase && createPortal(<CambiarBaseModal onClose={() => setCambiandoBase(false)} />, document.body)}
    </aside>
  );
}
