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
import Modal from './components/Modal.jsx';
import Toast from './components/Toast.jsx';
import { Icon } from './components/Icon.jsx';
import { downloadRespaldo } from '../services/remisiones.service.js';

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
    dismissToast,
  } = controller;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [respaldando, setRespaldando] = useState(false);
  // Vistas con una tabla/lista grande: ocupan la pantalla y el scroll ocurre dentro de la tabla
  const fillView = activeView !== 'resumen';
  const showRemisiones = activeView === 'remisiones';
  const pageTitle = activeView === 'resumen' ? 'Resumen de casos' : 'Panel de casos';

  useEffect(() => {
    if ((!createModalOpen && !deleteTarget) || saving || deletingId !== null) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setCreateModalOpen(false);
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [createModalOpen, deleteTarget, deletingId, saving]);

  const respaldar = async () => {
    setRespaldando(true);
    try {
      await downloadRespaldo();
      showToast('success', 'Respaldo descargado');
    } catch (reason) {
      showToast('error', reason.message);
    } finally {
      setRespaldando(false);
    }
  };

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
              <header className={styles.appHeader}>
                <div>
                  <h1 className={styles.pageTitle}>{pageTitle}</h1>
                  <p className={styles.pageSubtitle}>
                    {activeView === 'resumen'
                      ? 'Estadísticas generales y los últimos casos registrados.'
                      : 'Busca, filtra y administra los casos registrados.'}
                  </p>
                </div>
                <div className={styles.headerActions}>
                  {activeView === 'resumen' && (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={respaldar}
                      disabled={respaldando}
                      title="Descarga en un Excel todos los casos, remisiones, clientes y la lista de precios"
                    >
                      <Icon name="download" size={16} /> {respaldando ? 'Preparando…' : 'Respaldo en Excel'}
                    </button>
                  )}
                  <button type="button" className={styles.primaryBtn} onClick={() => setCreateModalOpen(true)}>
                    <Icon name="plus" size={16} /> Registrar caso
                  </button>
                </div>
              </header>

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
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setCreateModalOpen(false);
          }}
        >
          <section className={styles.modalPanel} role="dialog" aria-modal="true" aria-labelledby="create-case-title">
            <header className={styles.modalHeader}>
              <div>
                <h2 id="create-case-title" className={styles.modalTitle}>Registrar caso</h2>
                <p className={styles.pageSubtitle}>Ingresa la información inicial del caso.</p>
              </div>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setCreateModalOpen(false)}
                disabled={saving}
                aria-label="Cerrar"
              >
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className={styles.modalBody}>
              <NewCaseForm
                saving={saving}
                onSubmit={async (payload) => {
                  const created = await createCase(payload);
                  if (created) setCreateModalOpen(false);
                  return created;
                }}
                onCancel={() => setCreateModalOpen(false)}
              />
            </div>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && deletingId === null) setDeleteTarget(null);
          }}
        >
          <section className={styles.confirmModal} role="dialog" aria-modal="true" aria-labelledby="delete-case-title">
            <h2 id="delete-case-title" className={styles.modalTitle}>Eliminar caso</h2>
            <p>
              ¿Eliminar definitivamente el caso <strong>{deleteTarget.codigo}</strong>? Se borran también su historial y sus fotos. Esta acción no se puede deshacer.
            </p>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId !== null}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={confirmDelete}
                disabled={deletingId !== null}
              >
                {deletingId !== null ? 'Eliminando…' : 'Eliminar caso'}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedCase && (
        <CaseDetailDrawer
          caso={selectedCase}
          saving={saving}
          onClose={closeCase}
          onAddFollowUp={addFollowUp}
          onEdit={setEditTarget}
          onArchive={archiveCase}
          onDeleteImage={removePhoto}
          showToast={showToast}
          blocked={Boolean(editTarget)}
        />
      )}

      {editTarget && (
        <Modal title={`Editar caso ${editTarget.codigo}`} subtitle="Cambia los datos del caso; el historial y las fotos no se tocan." onClose={() => setEditTarget(null)} busy={saving}>
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
