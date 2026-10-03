import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const tone = toast.type === 'error' ? styles.toastError : styles.toastSuccess;

  return (
    <div className={`${styles.toast} ${tone}`} role="status" aria-live="polite" key={toast.id}>
      <span>{toast.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Cerrar notificación">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
