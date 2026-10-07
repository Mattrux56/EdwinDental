import { useEffect, useState } from 'react';
import styles from '../dashboard.module.css';
import { formatDate, formatEstimatedDate, formatMoney } from '../../utils/format.js';
import { remisionesService } from '../../services/remisiones.service.js';
import RemisionDetailModal from './RemisionDetailModal.jsx';
import { ConfirmModal } from './Modal.jsx';
import { Icon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';
import Timeline from './Timeline.jsx';
import FollowUpForm from './FollowUpForm.jsx';

export default function CaseDetailDrawer({
  caso,
  saving,
  onClose,
  onAddFollowUp,
  onEdit,
  onArchive,
  onDeleteImage,
  showToast,
  blocked = false,
}) {
  const [lightbox, setLightbox] = useState(null);
  const [imagenABorrar, setImagenABorrar] = useState(null);
  const [remisiones, setRemisiones] = useState([]);
  const [remisionAbierta, setRemisionAbierta] = useState(null);
  const subModalAbierto = Boolean(imagenABorrar || remisionAbierta);

  // Escape cierra primero la imagen ampliada y luego el panel (los submodales manejan su propio Escape)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || subModalAbierto || blocked) return;
      if (lightbox) setLightbox(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, onClose, subModalAbierto, blocked]);

  // Remisiones emitidas para este caso
  useEffect(() => {
    let active = true;
    remisionesService.list(caso.id).then((lista) => active && setRemisiones(lista)).catch(() => {});
    return () => {
      active = false;
    };
  }, [caso.id]);

  return (
    <div className={styles.detailOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={styles.detailModal} role="dialog" aria-modal="true" aria-label={`Trazabilidad ${caso.codigo}`}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerCode}>
              <span>{caso.codigo}</span>
              <StatusBadge estado={caso.estado} />
            </div>
            <h2 className={styles.drawerTitle}>{caso.titulo}</h2>
            {caso.archivado && <span className={styles.archivedTag}>Archivado</span>}
          </div>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div className={styles.drawerActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => onEdit(caso)} disabled={saving}>
              <Icon name="edit" size={15} /> Editar
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={() => onArchive(caso, !caso.archivado)} disabled={saving}>
              <Icon name="archive" size={15} /> {caso.archivado ? 'Restaurar' : 'Archivar'}
            </button>
          </div>

          <div className={styles.infoGrid}>
            <div>
              <div className={styles.infoLabel}>Cliente</div>
              <div className={styles.infoValue}>{caso.cliente?.nombre}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Paciente</div>
              <div className={styles.infoValue}>{caso.pacienteNombre || '—'}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Ingresó el</div>
              <div className={styles.infoValue}>
                {caso.fechaIngreso ? formatEstimatedDate(caso.fechaIngreso) : formatDate(caso.creadoEn)}
              </div>
            </div>
            <div>
              <div className={styles.infoLabel}>Entrega estimada</div>
              <div className={styles.infoValue}>{formatEstimatedDate(caso.fechaEntregaEstimada)}</div>
            </div>
          </div>

          {remisiones.length > 0 && (
            <div className={styles.caseRemisiones}>
              <h3 className={styles.sectionTitle}>Remisiones de este caso ({remisiones.length})</h3>
              <ul>
                {remisiones.map((rem) => (
                  <li key={rem.id}>
                    <button type="button" className={styles.linkBtn} onClick={() => setRemisionAbierta(rem)}>
                      N° {rem.numero}
                    </button>
                    <span className={styles.mutedText}>{formatEstimatedDate(rem.fecha)}</span>
                    <span>{formatMoney(rem.total)}</span>
                    {rem.anulada && <span className={`${styles.badge} ${styles.badgeDefault}`}>Anulada</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Timeline
            seguimientos={caso.seguimientos ?? []}
            onOpenImage={setLightbox}
            onDeleteImage={(id) => setImagenABorrar(id)}
            busy={saving}
          />

          <FollowUpForm key={caso.id} caso={caso} saving={saving} onSubmit={onAddFollowUp} />
        </div>
      </section>

      {imagenABorrar && (
        <ConfirmModal
          title="Eliminar fotografía"
          confirmLabel="Eliminar foto"
          busyLabel="Eliminando…"
          busy={saving}
          onCancel={() => setImagenABorrar(null)}
          onConfirm={async () => {
            if (await onDeleteImage(imagenABorrar)) setImagenABorrar(null);
          }}
        >
          <p>La foto se borra del historial y del almacenamiento. No se puede deshacer.</p>
        </ConfirmModal>
      )}

      {remisionAbierta && (
        <RemisionDetailModal remision={remisionAbierta} onClose={() => setRemisionAbierta(null)} showToast={showToast} />
      )}

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
