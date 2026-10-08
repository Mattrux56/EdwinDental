import { useState } from 'react';
import styles from './dashboard.module.css';
import r from './remisiones.module.css';
import { Icon } from './components/Icon.jsx';
import Modal, { ConfirmModal } from './components/Modal.jsx';
import { PageHeader } from './components/ui.jsx';
import NewRemisionForm from './components/NewRemisionForm.jsx';
import RemisionesTable from './components/RemisionesTable.jsx';
import RemisionDetailModal from './components/RemisionDetailModal.jsx';
import { formatRemisionNumber } from '../utils/format.js';

/** Vista de Remisiones: lista + creación a partir de un caso existente y la lista de precios */
export default function RemisionesView({ casos, controller, showToast }) {
  const { remisiones, productos, loading, error, saving, anulandoId, reload, createRemision, updateRemision, anularRemision, reactivarRemision } = controller;
  const [detalle, setDetalle] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [anularTarget, setAnularTarget] = useState(null);

  const confirmAnular = async () => {
    if (!anularTarget) return;
    if (await anularRemision(anularTarget)) {
      setAnularTarget(null);
      setDetalle(null);
    }
  };

  return (
    <>
      <PageHeader title="Remisiones" subtitle="Genera la remisión en Excel de un caso a partir de la lista de precios.">
        <button type="button" className={styles.primaryBtn} onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={16} /> Nueva remisión
        </button>
      </PageHeader>

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
        <Modal
          title={`Corregir remisión N° ${formatRemisionNumber(editTarget)}`}
          subtitle="Puedes cambiar tipo, número, fecha, orden, nombres impresos, productos y cantidades."
          onClose={() => setEditTarget(null)}
          busy={saving}
          className={r.wideModal}
        >
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
              }
              return updated;
            }}
          />
        </Modal>
      )}

      {createOpen && (
        <Modal
          title="Nueva remisión"
          subtitle="Elige el caso y la cantidad de cada producto."
          onClose={() => setCreateOpen(false)}
          busy={saving}
          className={r.wideModal}
        >
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
        </Modal>
      )}

      {anularTarget && (
        <ConfirmModal
          title="Anular remisión"
          confirmLabel="Anular remisión"
          busyLabel="Anulando…"
          busy={anulandoId !== null}
          onCancel={() => setAnularTarget(null)}
          onConfirm={confirmAnular}
        >
          <p>¿Anular la remisión N° {formatRemisionNumber(anularTarget)}? El número no se reutiliza. Si fue un error, podrás reactivarla.</p>
        </ConfirmModal>
      )}
    </>
  );
}
