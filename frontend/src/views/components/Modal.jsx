import { useEffect } from 'react';
import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';

/** Ventana modal estándar: cierra con Escape o al hacer clic fuera (salvo mientras `busy`) */
export default function Modal({ title, subtitle, onClose, busy = false, className = '', children }) {
  useEffect(() => {
    if (busy) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className={`${styles.modalPanel} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>{title}</h2>
            {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} disabled={busy} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className={styles.modalBody}>{children}</div>
      </section>
    </div>
  );
}

/** Confirmación con botón de acción (rojo por defecto) */
export function ConfirmModal({ title, children, confirmLabel, busyLabel, busy, danger = true, onConfirm, onCancel }) {
  useEffect(() => {
    if (busy) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section className={styles.confirmModal} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className={styles.modalTitle}>{title}</h2>
        <div>{children}</div>
        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className={danger ? styles.dangerBtn : styles.primaryBtn} onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel ?? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
