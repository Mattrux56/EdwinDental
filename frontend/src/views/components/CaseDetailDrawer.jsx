import { useEffect, useState } from 'react';
import styles from '../dashboard.module.css';
import { formatDate, formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import { remisionesService } from '../../services/remisiones.service.js';
import RemisionDetailModal from './RemisionDetailModal.jsx';
import { useEscape } from './Modal.jsx';
import { Icon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';
import Timeline from './Timeline.jsx';
import FollowUpForm from './FollowUpForm.jsx';
import EditHistorialModal from './EditHistorialModal.jsx';
import ImageViewer from './ImageViewer.jsx';

export default function CaseDetailDrawer({
  caso,
  saving,
  onClose,
  onAddFollowUp,
  onUpdateFollowUp,
  onEdit,
  onArchive,
  onDeleteImage,
  showToast,
  blocked = false,
}) {
  const [lightbox, setLightbox] = useState(null);
  const [remisiones, setRemisiones] = useState([]);
  const [remisionAbierta, setRemisionAbierta] = useState(null);
  const [editandoHistorial, setEditandoHistorial] = useState(false);
  const subModalAbierto = Boolean(remisionAbierta || editandoHistorial);

  // Escape cierra el panel solo si no hay otra ventana encima
  useEscape(() => {
    if (!subModalAbierto && !blocked && !lightbox) onClose();
  });

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
            <h2 className={styles.drawerTitle}>Orden de trabajo {caso.codigo}</h2>
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
              <div className={styles.infoLabel}>Doctor</div>
              <div className={styles.infoValue}>{caso.doctorNombre || '—'}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>Ingresó el</div>
              <div className={styles.infoValue}>
                {caso.fechaIngreso ? formatEstimatedDate(caso.fechaIngreso) : formatDate(caso.creadoEn)}
              </div>
            </div>
          </div>

          {remisiones.length > 0 && (
            <div className={styles.caseRemisiones}>
              <h3 className={styles.sectionTitle}>Remisiones de este caso ({remisiones.length})</h3>
              <ul>
                {remisiones.map((rem) => (
                  <li key={rem.id}>
                    <button type="button" className={styles.linkBtn} onClick={() => setRemisionAbierta(rem)}>
                      N° {formatRemisionNumber(rem)}
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
            onEdit={onUpdateFollowUp ? () => setEditandoHistorial(true) : undefined}
            editDisabled={saving}
            onOpenImage={setLightbox}
          />

          <FollowUpForm key={caso.id} caso={caso} saving={saving} onSubmit={onAddFollowUp} />
        </div>
      </section>

      {editandoHistorial && (
        <EditHistorialModal
          caso={caso}
          saving={saving}
          onClose={() => setEditandoHistorial(false)}
          onSave={onUpdateFollowUp}
          onDeleteImage={onDeleteImage}
        />
      )}

      {remisionAbierta && (
        <RemisionDetailModal remision={remisionAbierta} onClose={() => setRemisionAbierta(null)} showToast={showToast} />
      )}

      {lightbox && <ImageViewer src={lightbox} onClose={() => setLightbox(null)} />}

    </div>
  );
}
