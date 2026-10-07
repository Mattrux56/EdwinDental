import { useEffect, useState } from 'react';
import styles from './dashboard.module.css';
import r from './remisiones.module.css';
import { Icon } from './components/Icon.jsx';
import NewRemisionForm from './components/NewRemisionForm.jsx';
import RemisionesTable from './components/RemisionesTable.jsx';
import RemisionDetailModal from './components/RemisionDetailModal.jsx';
import { downloadRemisionExcel } from '../services/remisiones.service.js';

/** Vista de Remisiones: lista + creación a partir de un caso existente y la lista de precios */
export default function RemisionesView({ casos, controller, showToast }) {
  const { remisiones, productos, loading, error, saving, anulandoId, reload, createRemision, updateRemision, anularRemision, reactivarRemision } = controller;
  const [detalle, setDetalle] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [anularTarget, setAnularTarget] = useState(null);

  useEffect(() => {
    if ((!createOpen && !anularTarget && !editTarget) || saving || anulandoId !== null) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setCreateOpen(false);
        setAnularTarget(null);
        setEditTarget(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createOpen, anularTarget, editTarget, saving, anulandoId]);

  const confirmAnular = async () => {
    if (!anularTarget) return;
    if (await anularRemision(anularTarget)) {
      setAnularTarget(null);
      setDetalle(null);
    }
  };

  return (
    <>
      <header className={styles.appHeader}>
        <div>
          <h1 className={styles.pageTitle}>Remisiones</h1>
          <p className={styles.pageSubtitle}>Genera la remisión en Excel de un caso a partir de la lista de precios.</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={16} /> Nueva remisión
        </button>
      </header>

      <RemisionesTable
        remisiones={remisiones}
        loading={loading}
        error={error}
        onRetry={reload}
        onAnular={setAnularTarget}
        onReactivar={reactivarRemision}
        onView={setDetalle}
        onEdit={setEditTarget}
        anulandoId={anulandoId}
        showToast={showToast}
      />

      {detalle && !editTarget && !anularTarget && (
        <RemisionDetailModal
          remision={remisiones.find((x) => x.id === detalle.id) ?? detalle}
          onClose={() => setDetalle(null)}
          onEdit={(rem) => setEditTarget(rem)}
          onAnular={(rem) => setAnularTarget(rem)}
          onReactivar={reactivarRemision}
          reactivando={anulandoId === detalle.id}
          showToast={showToast}
        />
      )}

      {editTarget && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setEditTarget(null);
          }}
        >
          <section className={`${styles.modalPanel} ${r.wideModal}`} role="dialog" aria-modal="true" aria-labelledby="edit-remision-title">
            <header className={styles.modalHeader}>
              <div>
                <h2 id="edit-remision-title" className={styles.modalTitle}>Corregir remisión N° {editTarget.numero}</h2>
                <p className={styles.pageSubtitle}>Se mantiene el mismo número. Puedes cambiar fecha, orden, nombres impresos, productos y cantidades.</p>
              </div>
              <button type="button" className={styles.iconBtn} onClick={() => setEditTarget(null)} disabled={saving} aria-label="Cerrar">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className={styles.modalBody}>
              <NewRemisionForm
                remision={editTarget}
                casos={casos}
                productos={productos}
                saving={saving}
                onCancel={() => setEditTarget(null)}
                onSubmit={async (payload) => {
                  const updated = await updateRemision(editTarget.id, payload);
                  if (updated) {
                    setEditTarget(null);
                    setDetalle(null);
                    downloadRemisionExcel(updated.id, updated.numero).catch((e) => showToast?.('error', e.message));
                  }
                  return updated;
                }}
              />
            </div>
          </section>
        </div>
      )}

      {createOpen && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setCreateOpen(false);
          }}
        >
          <section className={`${styles.modalPanel} ${r.wideModal}`} role="dialog" aria-modal="true" aria-labelledby="create-remision-title">
            <header className={styles.modalHeader}>
              <div>
                <h2 id="create-remision-title" className={styles.modalTitle}>Nueva remisión</h2>
                <p className={styles.pageSubtitle}>Elige el caso y la cantidad de cada producto.</p>
              </div>
              <button type="button" className={styles.iconBtn} onClick={() => setCreateOpen(false)} disabled={saving} aria-label="Cerrar">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className={styles.modalBody}>
              <NewRemisionForm
                casos={casos}
                productos={productos}
                saving={saving}
                onCancel={() => setCreateOpen(false)}
                onSubmit={async (payload) => {
                  const created = await createRemision(payload);
                  if (created) setCreateOpen(false);
                  return created;
                }}
              />
            </div>
          </section>
        </div>
      )}

      {anularTarget && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && anulandoId === null) setAnularTarget(null);
          }}
        >
          <section className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="anular-remision-title">
            <h2 id="anular-remision-title" className={styles.modalTitle}>Anular remisión</h2>
            <p>
              ¿Anular la remisión N° {anularTarget.numero}? El número no se reutiliza. Si fue un error, podrás reactivarla.
            </p>
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setAnularTarget(null)} disabled={anulandoId !== null}>
                Cancelar
              </button>
              <button type="button" className={styles.dangerBtn} onClick={confirmAnular} disabled={anulandoId !== null}>
                {anulandoId !== null ? 'Anulando…' : 'Anular remisión'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
