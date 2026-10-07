import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './dashboard.module.css';
import { clientesService } from '../services/clientes.service.js';
import { clientesParecidos, idsDuplicados } from '../utils/clientes.js';
import { Icon } from './components/Icon.jsx';
import Modal, { ConfirmModal } from './components/Modal.jsx';

const norm = (t) => String(t ?? '').toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

function ClienteForm({ cliente, clientes, saving, onSubmit, onCancel }) {
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const parecidos = clientesParecidos(nombre, clientes.filter((c) => c.id !== cliente?.id)).slice(0, 3);
  return (
    <form
      className={styles.formCard}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ nombre });
      }}
    >
      <div className={styles.formGrid}>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="cli-nombre">Nombre <span className={styles.required}>*</span></label>
          <input id="cli-nombre" className={styles.input} value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={150} autoFocus />
          {parecidos.length > 0 && (
            <span className={styles.hint}>Ya hay clientes parecidos: {parecidos.map((c) => c.nombre).join(', ')}. ¿Seguro que no es el mismo?</span>
          )}
        </div>
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="submit" className={styles.primaryBtn} disabled={saving || !nombre.trim()}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}

export default function ClientesView({ showToast, onChanged }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [soloDuplicados, setSoloDuplicados] = useState(false);
  const [modal, setModal] = useState(null); // { tipo: 'form'|'eliminar', cliente }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setClientes(await clientesService.list());
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const duplicados = useMemo(() => idsDuplicados(clientes), [clientes]);
  // Si ya no quedan duplicados el filtro se ignora (si no, la lista quedaba vacía y sin botón para quitarlo)
  const filtrarDuplicados = soloDuplicados && duplicados.size > 0;

  const filtered = useMemo(() => {
    const term = norm(query.trim());
    return clientes.filter((c) =>
      (!filtrarDuplicados || duplicados.has(c.id)) &&
      (!term || norm(c.nombre).includes(term)),
    );
  }, [clientes, duplicados, query, filtrarDuplicados]);

  const run = async (action, okMessage) => {
    setSaving(true);
    try {
      const resultado = await action();
      const mensaje = typeof okMessage === 'function' ? okMessage(resultado) : okMessage;
      showToast('success', mensaje);
      setModal(null);
      await load();
      onChanged?.();
    } catch (reason) {
      showToast('error', reason.message);
    } finally {
      setSaving(false);
    }
  };

  const guardar = (payload) =>
    run(
      () => (modal.cliente ? clientesService.update(modal.cliente.id, payload) : clientesService.create(payload)),
      modal.cliente ? 'Cliente actualizado' : 'Cliente creado',
    );

  return (
    <>
      <header className={styles.appHeader}>
        <div>
          <h1 className={styles.pageTitle}>Clientes</h1>
          <p className={styles.pageSubtitle}>Doctores y clínicas. Corrige los nombres y revisa los repetidos.</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setModal({ tipo: 'form', cliente: null })}>
          <Icon name="plus" size={16} /> Nuevo cliente
        </button>
      </header>

      <section className={`${styles.panel} ${styles.panelFill}`}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Listado de clientes</h2>
          <span className={styles.panelMeta}>
            {loading ? 'Cargando…' : `${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'}`}
          </span>
        </div>
        <div className={styles.caseToolbar}>
          <label className={styles.caseSearch}>
            <Icon name="search" size={17} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre" aria-label="Buscar clientes" />
          </label>
          {duplicados.size > 0 && (
            <button
              type="button"
              className={`${styles.filterBtn} ${filtrarDuplicados ? styles.filterBtnActive : ''}`}
              onClick={() => setSoloDuplicados((v) => !v)}
              aria-pressed={filtrarDuplicados}
            >
              Posibles duplicados ({duplicados.size})
            </button>
          )}
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <span>{error}</span>
            <button type="button" className={styles.secondaryBtn} onClick={load}><Icon name="refresh" size={16} /> Reintentar</button>
          </div>
        )}
        {loading && clientes.length === 0 && !error && <div className={styles.loadingState}><span className={styles.spinner} /> Cargando clientes…</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>{clientes.length ? 'No hay coincidencias' : 'Aún no hay clientes'}</p>
            <span>{clientes.length ? 'Prueba otra búsqueda.' : 'Se crean al registrar un caso o con “Nuevo cliente”.'}</span>
          </div>
        )}

        {filtered.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th style={{ textAlign: 'right' }}>Casos</th>
                  <th style={{ textAlign: 'right' }} title="Remisiones vigentes (sin las anuladas)">Remisiones</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className={styles.clientName}>{c.nombre}</span>{' '}
                      {duplicados.has(c.id) && <span className={`${styles.badge} ${styles.badgeLab}`}>Posible duplicado</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{c._count.casos}</td>
                    <td style={{ textAlign: 'right' }}>{c.remisiones}</td>
                    <td>
                      <div className={styles.productActions}>
                        <button type="button" className={styles.secondaryBtn} onClick={() => setModal({ tipo: 'form', cliente: c })} disabled={saving}>Editar</button>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => setModal({ tipo: 'eliminar', cliente: c })}
                          disabled={saving || c._count.casos > 0}
                          title={c._count.casos > 0 ? 'Tiene casos: no se puede eliminar' : undefined}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal?.tipo === 'form' && (
        <Modal title={modal.cliente ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setModal(null)} busy={saving}>
          <ClienteForm cliente={modal.cliente} clientes={clientes} saving={saving} onSubmit={guardar} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal?.tipo === 'eliminar' && (
        <ConfirmModal
          title="Eliminar cliente"
          confirmLabel="Eliminar"
          busyLabel="Eliminando…"
          busy={saving}
          onCancel={() => setModal(null)}
          onConfirm={() => run(() => clientesService.remove(modal.cliente.id), 'Cliente eliminado')}
        >
          <p>
            ¿Eliminar a <strong>{modal.cliente.nombre}</strong>?{' '}
            No tiene casos registrados.
          </p>
        </ConfirmModal>
      )}
    </>
  );
}
