import { useState } from 'react';
import styles from '../styles/app.module.css';
import { Icon } from './components/Icon.jsx';
import Modal, { ConfirmModal } from './components/Modal.jsx';
import NewRemisionForm from './components/NewRemisionForm.jsx';
import ProductoForm from './components/ProductoForm.jsx';
import RemisionesTable from './components/RemisionesTable.jsx';
import RemisionDetailModal from './components/RemisionDetailModal.jsx';
import { remisionesService } from '../services/remisiones.service.js';
import { formatRemisionNumber } from '../utils/format.js';

/** Vista de Remisiones: lista + creación a partir de un caso existente y la lista de precios */
export default function RemisionesView({ casos, controller, showToast }) {
  const { remisiones, productos, loading, error, saving, anulandoId, reload, reloadProductos, createRemision, updateRemision, anularRemision, eliminarRemision, reactivarRemision } = controller;
  const [detalle, setDetalle] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [anularTarget, setAnularTarget] = useState(null);
  const [eliminarTarget, setEliminarTarget] = useState(null);
  // Producto nuevo creado desde el formulario de la remisión (se abre encima, sin perder lo ya escrito)
  const [productoOpen, setProductoOpen] = useState(false);
  const [guardandoProducto, setGuardandoProducto] = useState(false);

  const guardarProducto = async (payload) => {
    setGuardandoProducto(true);
    try {
      await remisionesService.createProducto(payload);
      showToast('success', 'Producto creado');
      await reloadProductos();
      return true;
    } catch (reason) {
      showToast('error', reason.message);
      return false;
    } finally {
      setGuardandoProducto(false);
    }
  };

  const confirmAnular = async () => {
    if (!anularTarget) return;
    if (await anularRemision(anularTarget)) {
      setAnularTarget(null);
      setDetalle(null);
    }
  };

  const confirmEliminar = async () => {
    if (!eliminarTarget) return;
    if (await eliminarRemision(eliminarTarget)) {
      setEliminarTarget(null);
      setDetalle(null);
    }
  };

  return (
    <>
      <RemisionesTable
        remisiones={remisiones}
        loading={loading}
        error={error}
        onRetry={reload}
        onView={setDetalle}
        actions={(
          <button type="button" className={styles.primaryBtn} onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={16} /> Nueva remisión
          </button>
        )}
        showToast={showToast}
      />

      {detalle && !editTarget && !anularTarget && !eliminarTarget && (
        <RemisionDetailModal
          remision={remisiones.find((x) => x.id === detalle.id) ?? detalle}
          onClose={() => setDetalle(null)}
          onEdit={(rem) => setEditTarget(rem)}
          onAnular={(rem) => setAnularTarget(rem)}
          onEliminar={(rem) => setEliminarTarget(rem)}
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
          className={styles.wideModal}
        >
          <NewRemisionForm
            remision={editTarget}
            casos={casos}
            productos={productos}
            saving={saving}
            onCancel={() => setEditTarget(null)}
            onNuevoProducto={() => setProductoOpen(true)}
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
          className={styles.wideModal}
        >
          <NewRemisionForm
            casos={casos}
            productos={productos}
            saving={saving}
            onCancel={() => setCreateOpen(false)}
            onNuevoProducto={() => setProductoOpen(true)}
            onSubmit={async (payload) => {
              const created = await createRemision(payload);
              if (created) setCreateOpen(false);
              return created;
            }}
          />
        </Modal>
      )}

      {productoOpen && (createOpen || editTarget) && (
        <Modal
          title="Nuevo producto"
          subtitle="Se agrega a la lista de precios y queda disponible en esta remisión."
          onClose={() => setProductoOpen(false)}
          busy={guardandoProducto}
        >
          <ProductoForm
            categorias={[...new Set(productos.map((p) => p.categoria))]}
            saving={guardandoProducto}
            onSubmit={guardarProducto}
            onCancel={() => setProductoOpen(false)}
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

      {eliminarTarget && (
        <ConfirmModal
          title="Eliminar remisión"
          confirmLabel="Eliminar remisión"
          busyLabel="Eliminando…"
          busy={anulandoId !== null}
          onCancel={() => setEliminarTarget(null)}
          onConfirm={confirmEliminar}
        >
          <p>¿Eliminar definitivamente la remisión anulada N° {formatRemisionNumber(eliminarTarget)}? Se borra con sus productos y su número queda libre. Esta acción no se puede deshacer.</p>
        </ConfirmModal>
      )}
    </>
  );
}
