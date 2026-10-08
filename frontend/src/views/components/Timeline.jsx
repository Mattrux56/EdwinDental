import { useState } from 'react';
import styles from '../dashboard.module.css';
import { formatDateTime, formatEstimatedDate } from '../../utils/format.js';
import { Icon } from './Icon.jsx';

function dotFor(tipo = '') {
  const t = tipo.toLowerCase();
  if (t.includes('ingreso inicial')) return { cls: styles.dotIngreso, icon: 'arrowIn' };
  if (t.includes('reingreso')) return { cls: styles.dotReingreso, icon: 'refresh' };
  if (t.includes('entrega')) return { cls: styles.dotEntrega, icon: 'check' };
  if (t.includes('arreglo')) return { cls: styles.dotReingreso, icon: 'refresh' };
  return { cls: styles.dotResultado, icon: 'flask' };
}

export default function Timeline({ seguimientos, onOpenImage, onEdit, editDisabled = false }) {
  const [newestFirst, setNewestFirst] = useState(false);
  const items = newestFirst ? [...seguimientos].reverse() : seguimientos;

  return (
    <>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Historial de trazabilidad ({seguimientos.length})</h3>
        <div className={styles.sectionActions}>
          {seguimientos.length > 1 && (
            <button type="button" className={styles.linkBtn} onClick={() => setNewestFirst((v) => !v)}>
              {newestFirst ? 'Ver en orden cronológico' : 'Ver más recientes primero'}
            </button>
          )}
          {onEdit && seguimientos.length > 0 && (
            <button type="button" className={styles.secondaryBtn} onClick={onEdit} disabled={editDisabled}>
              <Icon name="edit" size={15} /> Editar historial
            </button>
          )}
        </div>
      </div>

      <ol className={styles.timeline}>
        {items.map((seg) => {
          const { cls, icon } = dotFor(seg.tipo);
          return (
            <li key={seg.id} className={styles.timelineItem}>
              <span className={`${styles.timelineDot} ${cls}`}>
                <Icon name={icon} size={12} />
              </span>
              <div className={styles.timelineCard}>
                <div className={styles.timelineHead}>
                  <span className={styles.timelineTipo}>{seg.tipo}</span>
                  <time className={styles.timelineDate} dateTime={seg.creadoEn}>
                    {formatDateTime(seg.creadoEn)}
                  </time>
                  {seg.fechaEntregaEstimada && (
                    <span className={styles.timelineDelivery}>
                      Entrega estimada: {formatEstimatedDate(seg.fechaEntregaEstimada)}
                    </span>
                  )}
                </div>
                <p className={styles.timelineText}>{seg.descripcion}</p>

                {seg.imagenes?.length > 0 && (
                  <div className={styles.timelineImages}>
                    {seg.imagenes.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        className={styles.timelineImgBtn}
                        onClick={() => onOpenImage(img.urlImagen)}
                        aria-label="Ampliar fotografía"
                      >
                        <img src={img.urlImagen} alt="Fotografía del seguimiento" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
