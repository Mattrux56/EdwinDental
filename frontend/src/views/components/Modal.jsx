import { useEffect, useRef } from 'react';
import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';

const pilaEscape = [];

/** Escape actúa solo en la ventana de más arriba (modal, visor de imagen…), no en las que quedan debajo */
export function useEscape(onEscape) {
  const ultimo = useRef(onEscape);
  ultimo.current = onEscape;
  useEffect(() => {
    const token = {};
    pilaEscape.push(token);
    const onKey = (event) => {
      if (event.key === 'Escape' && pilaEscape[pilaEscape.length - 1] === token) ultimo.current(event);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      pilaEscape.splice(pilaEscape.indexOf(token), 1);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}

/** Ventana modal estándar: cierra con Escape o al hacer clic fuera (salvo mientras `busy`) */
export default function Modal({ title, subtitle, onClose, busy = false, className = '', children }) {
  useEscape(() => {
    if (!busy) onClose();
  });

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
  useEscape(() => {
    if (!busy) onCancel();
  });

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
