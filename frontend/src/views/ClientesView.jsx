import { useMemo, useState } from 'react';
import styles from '../styles/app.module.css';
import { useResource } from '../hooks/useResource.js';
import { clientesService } from '../services/clientes.service.js';
import { clientesParecidos, idsDuplicados } from '../utils/clientes.js';
import { matchesSearch } from '../utils/search.js';
import ClienteDetalle from './components/ClienteDetalle.jsx';
import DataTable from './components/DataTable.jsx';
import { Chip, FilterBar, SearchField } from './components/filters.jsx';
import { Icon } from './components/Icon.jsx';
import Modal, { ConfirmModal } from './components/Modal.jsx';
import { Badge, contar, Panel } from './components/ui.jsx';

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

export default function ClientesView({ showToast, onChanged, onOpenCase, casosVersion }) {
  const { data: clientes, loading, error, reload: load } = useResource(() => clientesService.list());
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [soloDuplicados, setSoloDuplicados] = useState(false);
  const [modal, setModal] = useState(null); // { tipo: 'form'|'eliminar', cliente }
  const [clienteAbierto, setClienteAbierto] = useState(null);

  const duplicados = useMemo(() => idsDuplicados(clientes), [clientes]);
  // Si ya no quedan duplicados el filtro se ignora (si no, la lista quedaba vacía y sin botón para quitarlo)
  const filtrarDuplicados = soloDuplicados && duplicados.size > 0;

  const filtered = useMemo(
    () => clientes.filter((c) => (!filtrarDuplicados || duplicados.has(c.id)) && matchesSearch(query, [c.nombre])),
    [clientes, duplicados, query, filtrarDuplicados],
  );

  const columnas = [
    {
      key: 'nombre',
      header: 'Nombre',
      render: (c) => (
        <>
          <span className={styles.clientName}>{c.nombre}</span>{' '}
          {duplicados.has(c.id) && <Badge tone="lab">Posible duplicado</Badge>}
        </>
      ),
    },
    { key: 'casos', header: 'Casos', align: 'right', render: (c) => c._count.casos },
    { key: 'remisiones', header: 'Remisiones', align: 'right', headerProps: { title: 'Remisiones vigentes (sin las anuladas)' }, render: (c) => c.remisiones },
    {
      key: 'acciones',
      header: '',
      headerProps: { 'aria-label': 'Acciones' },
      render: (c) => (
        <div className={styles.productActions}>
          <button type="button" className={styles.secondaryBtn} onClick={(e) => { e.stopPropagation(); setModal({ tipo: 'form', cliente: c }); }} disabled={saving}>Editar</button>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              setModal({ tipo: 'eliminar', cliente: c });
            }}
            disabled={saving || c._count.casos > 0}
            title={c._count.casos > 0 ? 'Tiene casos: no se puede eliminar' : undefined}
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ];

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

  if (clienteAbierto) {
    return (
      <ClienteDetalle
        cliente={clienteAbierto}
        onBack={() => setClienteAbierto(null)}
        onOpenCase={onOpenCase}
        showToast={showToast}
        version={casosVersion}
      />
    );
  }

  return (
    <>
      <Panel
        title="Clientes"
        meta={contar(filtered.length, 'cliente', 'clientes', loading)}
        actions={(
          <button type="button" className={styles.primaryBtn} onClick={() => setModal({ tipo: 'form', cliente: null })}>
            <Icon name="plus" size={16} /> Nuevo cliente
          </button>
        )}
      >
        <FilterBar>
          <SearchField value={query} onChange={setQuery} placeholder="Buscar por nombre" label="Buscar clientes" />
          {duplicados.size > 0 && (
            <Chip active={filtrarDuplicados} onClick={() => setSoloDuplicados((v) => !v)}>
              Posibles duplicados ({duplicados.size})
            </Chip>
          )}
        </FilterBar>

        <DataTable
          columns={columnas}
          rows={filtered}
          loading={loading}
          loadingText="Cargando clientes…"
          error={error}
          onRetry={load}
          onRowClick={setClienteAbierto}
          rowLabel={(c) => `Ver los casos de ${c.nombre}`}
          empty={clientes.length
            ? { title: 'No hay coincidencias', children: 'Prueba otra búsqueda.' }
            : { title: 'Aún no hay clientes', children: 'Se crean al registrar un caso o con “Nuevo cliente”.' }}
        />
      </Panel>

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
