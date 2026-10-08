import { useEffect, useState } from 'react';
import styles from './dashboard.module.css';
import Sidebar from './components/Sidebar.jsx';
import MetricCards from './components/MetricCards.jsx';
import CasesTable from './components/CasesTable.jsx';
import NewCaseForm from './components/NewCaseForm.jsx';
import CaseDetailDrawer from './components/CaseDetailDrawer.jsx';
import RemisionesView from './RemisionesView.jsx';
import ProductosView from './ProductosView.jsx';
import ClientesView from './ClientesView.jsx';
import AlertasView from './AlertasView.jsx';
import CuentasCobroView from './CuentasCobroView.jsx';
import EditCaseForm from './components/EditCaseForm.jsx';
import Modal, { ConfirmModal } from './components/Modal.jsx';
import { PageHeader } from './components/ui.jsx';
import Toast from './components/Toast.jsx';
import { Icon } from './components/Icon.jsx';

/** Vista pura: recibe todo el estado y las acciones desde el controlador (useCasesController) */
export default function DashboardView({ controller, remisionesController }) {
  const {
    casos,
    stats,
    loading,
    error,
    activeView,
    verArchivados,
    setVerArchivados,
    updateCase,
    archiveCase,
    removePhoto,
    selectedCase,
    saving,
    deletingId,
    toast,
    showToast,
    setActiveView,
    refresh,
    openCase,
    closeCase,
    createCase,
    deleteCase,
    addFollowUp,
    updateFollowUp,
    dismissToast,
  } = controller;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  // Vistas con una tabla/lista grande: ocupan la pantalla y el scroll ocurre dentro de la tabla
  const fillView = activeView !== 'resumen';
  const showRemisiones = activeView === 'remisiones';
  const pageTitle = activeView === 'resumen' ? 'Resumen de casos' : 'Panel de casos';

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const deleted = await deleteCase(deleteTarget);
    if (deleted) setDeleteTarget(null);
  };

  useEffect(() => {
    if (showRemisiones) {
      remisionesController.reloadProductos().catch((error) => {
        controller.showToast('error', error.message);
      });
    }
  }, [controller.showToast, remisionesController.reloadProductos, showRemisiones]);

  return (
    <div className={styles.shell}>
      <Sidebar
        active={activeView}
        onNavigate={setActiveView}
        alertCount={stats.alertas}
      />

      <div className={styles.main}>
        <main className={`${styles.content} ${fillView ? styles.contentFill : ''}`}>
          {showRemisiones ? (
            <RemisionesView casos={casos} controller={remisionesController} showToast={showToast} />
          ) : activeView === 'productos' ? (
            <ProductosView showToast={showToast} />
          ) : activeView === 'clientes' ? (
            <ClientesView showToast={showToast} onChanged={refresh} />
          ) : activeView === 'alertas' ? (
            <AlertasView casos={casos} onOpen={openCase} />
          ) : activeView === 'cuentas' ? (
            <CuentasCobroView showToast={showToast} />
          ) : (
            <>
              <PageHeader
                title={pageTitle}
                subtitle={activeView === 'resumen'
                  ? 'Estadísticas generales y los últimos casos registrados.'
                  : 'Busca, filtra y administra los casos registrados.'}
              >
                <div className={styles.headerActions}>
                  <button type="button" className={styles.primaryBtn} onClick={() => setCreateModalOpen(true)}>
                    <Icon name="plus" size={16} /> Registrar caso
                  </button>
                </div>
              </PageHeader>

              {activeView === 'resumen' ? (
                <>
                  <MetricCards stats={stats} />
                  <CasesTable
                    casos={casos.slice(0, 3)}
                    loading={loading}
                    error={error}
                    onOpen={openCase}
                    onRetry={refresh}
                    compact
                  />
                </>
              ) : (
                <CasesTable
                  casos={casos}
                  loading={loading}
                  error={error}
                  onOpen={openCase}
                  onRetry={refresh}
                  onDelete={setDeleteTarget}
                  deletingId={deletingId}
                  onArchive={archiveCase}
                  verArchivados={verArchivados}
                  onToggleArchivados={() => setVerArchivados((v) => !v)}
                  archivadosCount={stats.archivados}
                />
              )}
            </>
          )}
        </main>
      </div>

      {createModalOpen && (
        <Modal title="Registrar caso" subtitle="Ingresa la información inicial del caso." onClose={() => setCreateModalOpen(false)} busy={saving}>
          <NewCaseForm
            saving={saving}
            onSubmit={async (payload) => {
              const created = await createCase(payload);
              if (created) setCreateModalOpen(false);
              return created;
            }}
            onCancel={() => setCreateModalOpen(false)}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar caso"
          confirmLabel="Eliminar caso"
          busyLabel="Eliminando…"
          busy={deletingId !== null}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        >
          <p>
            ¿Eliminar definitivamente la orden de trabajo <strong>{deleteTarget.codigo}</strong>? Se borran también su historial y sus fotos. Esta acción no se puede deshacer.
          </p>
        </ConfirmModal>
      )}

      {selectedCase && (
        <CaseDetailDrawer
          caso={selectedCase}
          saving={saving}
          onClose={closeCase}
          onAddFollowUp={addFollowUp}
          onUpdateFollowUp={updateFollowUp}
          onEdit={setEditTarget}
          onArchive={archiveCase}
          onDeleteImage={removePhoto}
          showToast={showToast}
          blocked={Boolean(editTarget)}
        />
      )}

      {editTarget && (
        <Modal title={`Editar orden de trabajo ${editTarget.codigo}`} subtitle="Cambia los datos del caso; el historial y las fotos no se tocan." onClose={() => setEditTarget(null)} busy={saving}>
          <EditCaseForm
            caso={editTarget}
            saving={saving}
            onCancel={() => setEditTarget(null)}
            onSubmit={async (payload) => {
              if (await updateCase(editTarget.id, payload)) setEditTarget(null);
            }}
          />
        </Modal>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
