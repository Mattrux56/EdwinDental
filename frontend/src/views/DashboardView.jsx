import styles from './dashboard.module.css';
import Sidebar from './components/Sidebar.jsx';
import SearchBar from './components/SearchBar.jsx';
import MetricCards from './components/MetricCards.jsx';
import CasesTable from './components/CasesTable.jsx';
import NewCaseForm from './components/NewCaseForm.jsx';
import CaseDetailDrawer from './components/CaseDetailDrawer.jsx';
import Toast from './components/Toast.jsx';
import { Icon } from './components/Icon.jsx';

/** Vista pura: recibe todo el estado y las acciones desde el controlador (useCasesController) */
export default function DashboardView({ controller }) {
  const {
    casos,
    stats,
    search,
    loading,
    error,
    activeView,
    selectedCase,
    saving,
    toast,
    setSearch,
    setActiveView,
    refresh,
    openCase,
    closeCase,
    createCase,
    addFollowUp,
    dismissToast,
  } = controller;

  return (
    <div className={styles.shell}>
      <Sidebar active={activeView} onNavigate={setActiveView} />

      <div className={styles.main}>
        <SearchBar value={search} onChange={setSearch} />

        <main className={styles.content}>
          {activeView === 'nuevo' ? (
            <NewCaseForm
              saving={saving}
              onSubmit={createCase}
              onCancel={() => setActiveView('dashboard')}
            />
          ) : (
            <>
              <div className={styles.pageHeader}>
                <div>
                  <h1 className={styles.pageTitle}>Panel de casos</h1>
                  <p className={styles.pageSubtitle}>
                    Consulta el estado de cada caso y su historial de ingresos y reingresos.
                  </p>
                </div>
                <button type="button" className={styles.primaryBtn} onClick={() => setActiveView('nuevo')}>
                  <Icon name="plus" size={16} /> Registrar caso
                </button>
              </div>

              <MetricCards stats={stats} />

              <CasesTable
                casos={casos}
                loading={loading}
                error={error}
                search={search.trim()}
                onOpen={openCase}
                onRetry={refresh}
              />
            </>
          )}
        </main>
      </div>

      {selectedCase && (
        <CaseDetailDrawer
          caso={selectedCase}
          saving={saving}
          onClose={closeCase}
          onAddFollowUp={addFollowUp}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
