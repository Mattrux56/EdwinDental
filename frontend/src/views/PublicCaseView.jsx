import { useEffect, useState } from 'react';
import styles from './dashboard.module.css';
import { casesService } from '../services/cases.service.js';
import { formatDate, formatEstimatedDate } from '../utils/format.js';
import StatusBadge from './components/StatusBadge.jsx';
import Timeline from './components/Timeline.jsx';
import ImageViewer from './components/ImageViewer.jsx';

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
            <h2 className={styles.drawerTitle}>Orden de trabajo {caso.codigo}</h2>
            <div className={styles.infoGrid}>
              <div>
                <div className={styles.infoLabel}>Ingresó el</div>
                <div className={styles.infoValue}>
                  {caso.fechaIngreso ? formatEstimatedDate(caso.fechaIngreso) : formatDate(caso.creadoEn)}
                </div>
              </div>
            </div>
            <Timeline seguimientos={caso.seguimientos} onOpenImage={setLightbox} />
          </section>
        )}
      </div>

      {lightbox && <ImageViewer src={lightbox} onClose={() => setLightbox(null)} />}
    </main>
  );
}
