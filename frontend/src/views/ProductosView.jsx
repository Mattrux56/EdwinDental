import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './dashboard.module.css';
import { formatMoney } from '../utils/format.js';
import { downloadListaPrecios, remisionesService } from '../services/remisiones.service.js';
import { Icon } from './components/Icon.jsx';
import ProductoForm from './components/ProductoForm.jsx';

export default function ProductosView({ showToast }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [importando, setImportando] = useState(false);
  const archivoRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProductos(await remisionesService.productosAdmin());
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!modal || saving) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modal, saving]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    if (!term) return productos;
    return productos.filter((producto) =>
      [producto.codigo, producto.categoria, producto.descripcion, producto.valor]
        .some((value) => String(value).toLocaleLowerCase('es').includes(term)),
    );
  }, [productos, query]);

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
    }
  };

  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))], [productos]);

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

  return (
    <>
      <header className={styles.appHeader}>
        <div>
          <h1 className={styles.pageTitle}>Productos</h1>
          <p className={styles.pageSubtitle}>Administra el catálogo y los precios usados en las remisiones.</p>
        </div>
        <div className={styles.headerActions}>
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
        </div>
      </header>

      <section className={`${styles.panel} ${styles.panelFill}`}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Catálogo de productos</h2>
          <span className={styles.panelMeta}>
            {loading ? 'Cargando…' : `${filtered.length} ${filtered.length === 1 ? 'producto' : 'productos'}`}
          </span>
        </div>

        <div className={styles.caseToolbar}>
          <label className={styles.caseSearch}>
            <Icon name="search" size={17} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por código, categoría o descripción"
              aria-label="Buscar productos"
            />
          </label>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <span>{error}</span>
            <button type="button" className={styles.secondaryBtn} onClick={load}>
              <Icon name="refresh" size={16} /> Reintentar
            </button>
          </div>
        )}

        {loading && productos.length === 0 && !error && (
          <div className={styles.loadingState}><span className={styles.spinner} /> Cargando productos…</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>{productos.length ? 'No hay coincidencias' : 'El catálogo está vacío'}</p>
            <span>
              {productos.length ? 'Prueba otra búsqueda.' : 'Agrega productos para poder seleccionarlos en las remisiones.'}
            </span>
          </div>
        )}

        {filtered.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((producto) => (
                  <tr key={producto.id}>
                    <td className={styles.codeCell}>{producto.codigo}</td>
                    <td>{producto.categoria}</td>
                    <td>{producto.descripcion}</td>
                    <td>{formatMoney(producto.valor)}</td>
                    <td>
                      <span className={`${styles.badge} ${producto.activo ? styles.badgeLab : styles.badgeDefault}`}>
                        {producto.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.productActions}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => setModal({ producto })}
                          disabled={saving}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => toggleActive(producto)}
                          disabled={saving}
                        >
                          {producto.activo ? 'Desactivar' : 'Activar'}
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

      {modal && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setModal(null);
          }}
        >
          <section className={styles.modalPanel} role="dialog" aria-modal="true" aria-labelledby="producto-modal-title">
            <header className={styles.modalHeader}>
              <div>
                <h2 id="producto-modal-title" className={styles.modalTitle}>
                  {modal.producto ? 'Editar producto' : 'Nuevo producto'}
                </h2>
                <p className={styles.pageSubtitle}>El producto se guardará en la base de datos.</p>
              </div>
              <button type="button" className={styles.iconBtn} onClick={() => setModal(null)} disabled={saving} aria-label="Cerrar">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className={styles.modalBody}>
              <ProductoForm
                key={modal.producto?.id ?? 'new'}
                producto={modal.producto}
                categorias={categorias}
                saving={saving}
                onSubmit={save}
                onCancel={() => setModal(null)}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
