import { useEffect, useState } from 'react';
import styles from './dashboard.module.css';
import { casesService } from '../services/cases.service.js';
import { formatDate, formatEstimatedDate } from '../utils/format.js';
import StatusBadge from './components/StatusBadge.jsx';
import Timeline from './components/Timeline.jsx';
import { Icon } from './components/Icon.jsx';

export default function PublicCaseView({ codigo }) {
  const [caso, setCaso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let active = true;
    casesService.getPublicByCode(codigo)
      .then((data) => {
        if (active) setCaso(data);
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [codigo]);

  useEffect(() => {
    if (!lightbox) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [lightbox]);

  return (
    <main className={styles.publicShell}>
      <div className={styles.publicContent}>
        <header className={styles.publicHeader}>
          <h1 className={styles.pageTitle}>Consulta de caso</h1>
          <p className={styles.pageSubtitle}>Trazabilidad y estado de tu trabajo de laboratorio.</p>
        </header>

        {loading && <div className={styles.publicNotice}>Consultando el caso…</div>}
        {!loading && error && (
          <div className={styles.publicNotice} role="alert">
            <h1>No fue posible consultar el caso</h1>
            <p>{error}</p>
          </div>
        )}
        {caso && (
          <section className={styles.publicCard}>
            <div className={styles.drawerCode}>
              <span>{caso.codigo}</span>
              <StatusBadge estado={caso.estado} />
            </div>
            <h2 className={styles.drawerTitle}>{caso.titulo}</h2>
            <div className={styles.infoGrid}>
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
            <Timeline seguimientos={caso.seguimientos} onOpenImage={setLightbox} />
          </section>
        )}
      </div>

      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img className={styles.lightboxImg} src={lightbox} alt="Fotografía ampliada" />
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setLightbox(null)}
            aria-label="Cerrar imagen"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      )}
    </main>
  );
}
