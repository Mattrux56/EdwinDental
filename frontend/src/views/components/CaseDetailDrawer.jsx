import { useEffect, useState } from 'react';
import styles from '../dashboard.module.css';
import { formatDate } from '../../utils/format.js';
import { Icon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';
import Timeline from './Timeline.jsx';
import FollowUpForm from './FollowUpForm.jsx';

export default function CaseDetailDrawer({ caso, saving, onClose, onAddFollowUp }) {
  const [lightbox, setLightbox] = useState(null);

  // Escape cierra primero la imagen ampliada y luego el panel
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (lightbox) setLightbox(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, onClose]);

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Trazabilidad ${caso.codigo}`}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerCode}>
              <span>{caso.codigo}</span>
              <StatusBadge estado={caso.estado} />
            </div>
            <h2 className={styles.drawerTitle}>{caso.titulo}</h2>
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div className={styles.infoGrid}>
            <div>
              <div className={styles.infoLabel}>Cliente</div>
              <div className={styles.infoValue}>{caso.cliente?.nombre}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Documento</div>
              <div className={styles.infoValue}>{caso.cliente?.documentoIdentidad || '—'}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Ingresó el</div>
              <div className={styles.infoValue}>{formatDate(caso.creadoEn)}</div>
            </div>
          </div>

          <Timeline seguimientos={caso.seguimientos ?? []} onOpenImage={setLightbox} />

          <FollowUpForm key={caso.id} caso={caso} saving={saving} onSubmit={onAddFollowUp} />
        </div>
      </aside>

      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img className={styles.lightboxImg} src={lightbox} alt="Fotografía ampliada" />
          <button type="button" className={styles.lightboxClose} onClick={() => setLightbox(null)} aria-label="Cerrar imagen">
            <Icon name="close" size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
