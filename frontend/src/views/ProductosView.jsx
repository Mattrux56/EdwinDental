import { useMemo, useRef, useState } from 'react';
import styles from '../styles/app.module.css';
import { useResource } from '../hooks/useResource.js';
import { downloadListaPrecios, remisionesService } from '../services/remisiones.service.js';
import { formatMoney } from '../utils/format.js';
import { matchesSearch } from '../utils/search.js';
import DataTable from './components/DataTable.jsx';
import { FilterBar, SearchField, SelectFilter } from './components/filters.jsx';
import { Icon } from './components/Icon.jsx';
import Modal, { ConfirmModal } from './components/Modal.jsx';
import ProductoForm from './components/ProductoForm.jsx';
import { Badge, contar, Panel } from './components/ui.jsx';

export default function ProductosView({ showToast }) {
  const { data: productos, loading, error, reload: load } = useResource(() => remisionesService.productosAdmin());
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [importando, setImportando] = useState(false);
  const archivoRef = useRef(null);

  const [categoriaElegida, setCategoriaElegida] = useState('');
  const [orden, setOrden] = useState('asc'); // por código: 'asc' (1001 arriba) o 'desc' (el más alto arriba)
  const [confirmar, setConfirmar] = useState(null); // { accion: 'estado' | 'eliminar', producto }

  // Si la categoría elegida ya no existe (se eliminó su último producto o se renombró), vale «todas»
  const categoria = productos.some((p) => p.categoria === categoriaElegida) ? categoriaElegida : '';

  // Se agrupa por categoría para poder poner una barra al cambiar; las categorías van según su código más bajo (o más alto en 'desc')
  const filtered = useMemo(() => {
    const signo = orden === 'asc' ? 1 : -1;
    const lista = productos.filter((p) =>
      (!categoria || p.categoria === categoria) &&
      matchesSearch(query, [p.codigo, p.categoria, p.descripcion, p.valor]));
    const extremo = new Map();
    lista.forEach((p) => {
      const actual = extremo.get(p.categoria);
      if (actual === undefined || (orden === 'asc' ? p.codigo < actual : p.codigo > actual)) extremo.set(p.categoria, p.codigo);
    });
    return lista.sort((a, b) =>
      signo * (extremo.get(a.categoria) - extremo.get(b.categoria)) ||
      a.categoria.localeCompare(b.categoria, 'es') ||
      signo * (a.codigo - b.codigo) ||
      signo * (a.id - b.id));
  }, [productos, query, categoria, orden]);

  const save = async (payload) => {
    setSaving(true);
    try {
      if (modal.producto) {
        await remisionesService.updateProducto(modal.producto.id, payload);
        showToast('success', 'Producto actualizado');
      } else {
        await remisionesService.createProducto(payload);
        showToast('success', 'Producto creado');
      }
      await load();
      return true;
    } catch (reason) {
      showToast('error', reason.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (producto) => {
    setSaving(true);
    try {
      await remisionesService.updateProducto(producto.id, { activo: !producto.activo });
      showToast('success', producto.activo ? 'Producto desactivado' : 'Producto activado');
      await load();
    } catch (reason) {
      showToast('error', reason.message);
    } finally {
      setSaving(false);
      setConfirmar(null);
    }
  };

  const eliminar = async (producto) => {
    setSaving(true);
    try {
      await remisionesService.deleteProducto(producto.id);
      showToast('success', 'Producto eliminado');
      await load();
    } catch (reason) {
      showToast('error', reason.message);
    } finally {
      setSaving(false);
      setConfirmar(null);
    }
  };

  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))], [productos]);
  const opcionesCategoria = useMemo(
    () => [{ value: '', label: 'Todas las categorías' }, ...[...categorias].sort((a, b) => a.localeCompare(b, 'es'))],
    [categorias],
  );

  const importar = async (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    setImportando(true);
    try {
      const res = await remisionesService.importarProductos(archivo);
      const omitidas = res.omitidas.length
        ? ` · ${res.omitidas.length} fila(s) omitidas (${res.omitidas.slice(0, 3).map((o) => `fila ${o.fila}: ${o.motivo}`).join('; ')}${res.omitidas.length > 3 ? '…' : ''})`
        : '';
      showToast(res.omitidas.length ? 'error' : 'success', `Importación lista: ${res.creados} nuevos, ${res.actualizados} actualizados${omitidas}`);
      await load();
    } catch (reason) {
      showToast('error', reason.message);
    } finally {
      setImportando(false);
    }
  };

  const exportar = () => downloadListaPrecios().catch((reason) => showToast('error', reason.message));

  const columnas = [
    {
      key: 'codigo',
      header: (
        <button
          type="button"
          className={styles.sortBtn}
          onClick={() => setOrden((actual) => (actual === 'asc' ? 'desc' : 'asc'))}
          title={orden === 'asc' ? 'Del código más bajo al más alto; clic para invertir' : 'Del código más alto al más bajo; clic para invertir'}
        >
          Código <span aria-hidden="true">{orden === 'asc' ? '▲' : '▼'}</span>
        </button>
      ),
      headerProps: { 'aria-sort': orden === 'asc' ? 'ascending' : 'descending' },
      className: styles.codeCell,
      render: (p) => p.codigo,
    },
    { key: 'categoria', header: 'Categoría', render: (p) => p.categoria },
    { key: 'descripcion', header: 'Descripción', render: (p) => p.descripcion },
    { key: 'valor', header: 'Valor', render: (p) => formatMoney(p.valor) },
    {
      key: 'estado',
      header: 'Estado',
      render: (p) => (
        <button
          type="button"
          className={styles.statusBtn}
          onClick={() => setConfirmar({ accion: 'estado', producto: p })}
          disabled={saving}
          title={p.activo ? 'Clic para desactivar' : 'Clic para activar'}
        >
          <Badge tone={p.activo ? 'lab' : 'default'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
        </button>
      ),
    },
    {
      key: 'acciones',
      header: '',
      headerProps: { 'aria-label': 'Acciones' },
      render: (p) => (
        <div className={styles.productActions}>
          <button type="button" className={styles.secondaryBtn} onClick={() => setModal({ producto: p })} disabled={saving}>Editar</button>
          <button type="button" className={styles.deleteBtn} onClick={() => setConfirmar({ accion: 'eliminar', producto: p })} disabled={saving}>
            <Icon name="trash" size={15} /> Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Panel
        title="Catálogo de productos"
        meta={contar(filtered.length, 'producto', 'productos', loading)}
        actions={(
        <>
          <input ref={archivoRef} type="file" accept=".xlsx" className={styles.hiddenInput} onChange={importar} />
          <button type="button" className={styles.secondaryBtn} onClick={exportar} title="Descarga la lista de precios actual en Excel">
            <Icon name="download" size={16} /> Exportar
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => archivoRef.current?.click()} disabled={importando} title="Actualiza precios y agrega productos desde un Excel (Código, Categoría, Descripción, Valor)">
            <Icon name="upload" size={16} /> {importando ? 'Importando…' : 'Importar Excel'}
          </button>
          <button type="button" className={styles.primaryBtn} onClick={() => setModal({ producto: null })}>
            <Icon name="plus" size={16} /> Nuevo producto
          </button>
        </>
        )}
      >
        <FilterBar>
          <SelectFilter value={categoria} onChange={setCategoriaElegida} options={opcionesCategoria} label="Filtrar por categoría" />
          <SearchField value={query} onChange={setQuery} placeholder="Buscar por código, categoría o descripción" label="Buscar productos" />
        </FilterBar>

        <DataTable
          columns={columnas}
          rows={filtered}
          groupKey={(p) => p.categoria}
          loading={loading}
          loadingText="Cargando productos…"
          error={error}
          onRetry={load}
          empty={productos.length
            ? { title: 'No hay coincidencias', children: 'Prueba otra búsqueda.' }
            : { title: 'El catálogo está vacío', children: 'Agrega productos para poder seleccionarlos en las remisiones.' }}
        />
      </Panel>

      {confirmar?.accion === 'estado' && (
        <ConfirmModal
          title={confirmar.producto.activo ? 'Desactivar producto' : 'Activar producto'}
          confirmLabel={confirmar.producto.activo ? 'Desactivar' : 'Activar'}
          busyLabel={confirmar.producto.activo ? 'Desactivando…' : 'Activando…'}
          danger={confirmar.producto.activo}
          busy={saving}
          onCancel={() => setConfirmar(null)}
          onConfirm={() => toggleActive(confirmar.producto)}
        >
          <p>
            {confirmar.producto.activo
              ? <>¿Desactivar <strong>{confirmar.producto.codigo} · {confirmar.producto.descripcion}</strong>? Dejará de aparecer al crear remisiones, pero las ya emitidas no cambian.</>
              : <>¿Activar <strong>{confirmar.producto.codigo} · {confirmar.producto.descripcion}</strong>? Volverá a aparecer al crear remisiones.</>}
          </p>
        </ConfirmModal>
      )}

      {confirmar?.accion === 'eliminar' && (
        <ConfirmModal
          title="Eliminar producto"
          confirmLabel="Eliminar producto"
          busyLabel="Eliminando…"
          busy={saving}
          onCancel={() => setConfirmar(null)}
          onConfirm={() => eliminar(confirmar.producto)}
        >
          <p>
            ¿Eliminar <strong>{confirmar.producto.codigo} · {confirmar.producto.descripcion}</strong> del catálogo? Esta acción no se puede deshacer.
            Si el producto ya está en alguna remisión no se podrá eliminar: desactívalo.
          </p>
        </ConfirmModal>
      )}

      {modal && (
        <Modal
          title={modal.producto ? 'Editar producto' : 'Nuevo producto'}
          subtitle="El producto se guardará en la base de datos."
          onClose={() => setModal(null)}
          busy={saving}
        >
          <ProductoForm
            key={modal.producto?.id ?? 'new'}
            producto={modal.producto}
            categorias={categorias}
            saving={saving}
            onSubmit={save}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </>
  );
}
