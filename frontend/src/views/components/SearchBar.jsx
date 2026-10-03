import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';

export default function SearchBar({ value, onChange }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.searchBox}>
        <span className={styles.searchIcon}>
          <Icon name="search" />
        </span>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Buscar por código, título, cliente o ID"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Buscar casos"
        />
        {value && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => onChange('')}
            aria-label="Limpiar búsqueda"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
