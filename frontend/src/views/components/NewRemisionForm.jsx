import { useEffect, useMemo, useState } from 'react';
import styles from '../../styles/app.module.css';
import { formatMoney } from '../../utils/format.js';
import { Icon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';
import { DateFilter, SearchField } from './filters.jsx';
import { matchesSearch, normalizeSearchText } from '../../utils/search.js';
import { remisionesService } from '../../services/remisiones.service.js';

const MAX_LINEAS = 8; // lo que cabe en el formato de remisión del laboratorio
const MAX_CANTIDAD = 999;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function CasePicker({ casos, selected, onSelect, locked = false }) {
  const [query, setQuery] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');

  const matches = useMemo(() => {
    const list = casos.filter((c) => {
      const fecha = String(c.fechaIngreso ?? c.creadoEn ?? '').slice(0, 10);
      return (!fechaIngreso || fecha === fechaIngreso) &&
        matchesSearch(query, [c.codigo, c.doctorNombre, c.cliente?.nombre, c.pacienteNombre]);
    });
    return list.slice(0, 50);
  }, [casos, fechaIngreso, query]);

  if (selected) {
    return (
      <div className={styles.selectedCase}>
        <div className={styles.pickerItemMain}>
          <div className={styles.pickerItemTitle}>
            <span className={styles.code}>Orden {selected.codigo}</span>
          </div>
          <div className={styles.pickerItemMeta}>
            {selected.cliente?.nombre} · Paciente: {selected.pacienteNombre || '—'}
          </div>
        </div>
        {!locked && (
          <button type="button" className={styles.secondaryBtn} onClick={() => onSelect(null)}>
            Cambiar caso
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.pickerBox}>
      <div className={styles.pickerBar}>
        <SearchField
          className={styles.pickerSearch}
          value={query}
          onChange={setQuery}
          placeholder="Buscar por orden, doctor, cliente o paciente"
          label="Buscar caso"
          autoFocus
        />
        <DateFilter
          label="Fecha de ingreso"
          value={fechaIngreso}
          onChange={setFechaIngreso}
          ariaLabel="Filtrar casos por fecha de ingreso"
          className={styles.pickerDate}
        />
      </div>
      {matches.length === 0 ? (
        <div className={styles.pickerEmpty}>
          {casos.length === 0 ? 'Aún no hay casos registrados.' : 'Ningún caso coincide con los filtros.'}
        </div>
      ) : (
        <ul className={styles.pickerList}>
          {matches.map((caso) => (
            <li key={caso.id}>
              <button type="button" className={styles.pickerItem} onClick={() => onSelect(caso)}>
                <div className={styles.pickerItemMain}>
                  <div className={styles.pickerItemTitle}>
                    <span className={styles.code}>Orden {caso.codigo}</span>
                  </div>
                  <div className={styles.pickerItemMeta}>
                    {caso.cliente?.nombre} · Paciente: {caso.pacienteNombre || '—'}
                  </div>
                </div>
                <StatusBadge estado={caso.estado} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuantityControl({ value, onChange, disabled, label }) {
  return (
    <div className={styles.qty}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={disabled || value <= 0} aria-label={`Quitar uno: ${label}`}>
        −
      </button>
      <input
        type="number"
        min="0"
        max={MAX_CANTIDAD}
        inputMode="numeric"
        value={value === 0 ? '' : value}
        placeholder="0"
        disabled={disabled}
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 0)}
        aria-label={`Cantidad: ${label}`}
      />
      <button type="button" onClick={() => onChange(value + 1)} disabled={disabled || value >= MAX_CANTIDAD} aria-label={`Agregar uno: ${label}`}>
        +
      </button>
    </div>
  );
}

/**
 * Crea una remisión nueva o, si se pasa `remision`, permite corregir sus datos y numeración,
 * los productos que ya estaban conservan su precio y los nuevos toman el precio vigente.
 */
export default function NewRemisionForm({ casos, productos: productosActivos, saving, onSubmit, onCancel, remision, onNuevoProducto }) {
  const editando = Boolean(remision);
  const [caso, setCaso] = useState(remision?.caso ?? null);
  const [fecha, setFecha] = useState(remision ? String(remision.fecha).slice(0, 10) : today);
  const [noOrden, setNoOrden] = useState(remision?.noOrden ?? '');
  const [tipo, setTipo] = useState(remision?.tipo ?? 'NORMAL');
  const [doctorNombre, setDoctorNombre] = useState(remision?.doctorNombre ?? remision?.caso?.doctorNombre ?? '');
  const [pacienteNombre, setPacienteNombre] = useState(remision?.pacienteNombre ?? remision?.caso?.pacienteNombre ?? '');
  const [lineas, setLineas] = useState(
    () => remision?.items.filter((i) => i.productoId !== null).map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })) ?? [],
  ); // [{ productoId, cantidad }] en el orden en que se eligieron
  const [query, setQuery] = useState('');
  const [categoria, setCategoria] = useState('');
  const [numero, setNumero] = useState(remision ? String(remision.numero) : '');
  const [numeroError, setNumeroError] = useState('');
  const [numeroConsultado, setNumeroConsultado] = useState(false);
  const [primeraRemision, setPrimeraRemision] = useState(false);

  // En edición se conservan los productos de la remisión aunque ya no estén activos en la lista de precios
  const productos = useMemo(() => {
    if (!remision) return productosActivos;
    const activos = new Set(productosActivos.map((p) => p.id));
    const extra = remision.items
      .filter((i) => i.productoId !== null && !activos.has(i.productoId))
      .map((i) => ({ id: i.productoId, codigo: '—', categoria: 'Ya en esta remisión', descripcion: i.descripcion, valor: i.valorUnitario }));
    return [...extra, ...productosActivos];
  }, [productosActivos, remision]);

  // Precio con el que se emitió cada línea existente (no cambia aunque la lista de precios sí)
  const precioOriginal = useMemo(
    () => new Map((remision?.items ?? []).filter((i) => i.productoId !== null).map((i) => [i.productoId, i.valorUnitario])),
    [remision],
  );

  useEffect(() => {
    if (editando) return undefined;
    let activo = true;
    remisionesService.siguienteNumero(tipo).then(
      ({ siguiente }) => {
        if (activo) {
          setPrimeraRemision(siguiente === null);
          if (siguiente !== null) setNumero((actual) => actual || String(siguiente));
          setNumeroConsultado(true);
        }
      },
      (error) => {
        if (activo) {
          setNumeroError(`No se pudo consultar el siguiente número: ${error.message}`);
          setNumeroConsultado(true);
        }
      },
    );
    return () => {
      activo = false;
    };
  }, [editando, tipo]);

  const cantidadDe = (id) => lineas.find((l) => l.productoId === id)?.cantidad ?? 0;
  const llena = lineas.length >= MAX_LINEAS;

  const setCantidad = (productoId, valor) => {
    const cantidad = Math.max(0, Math.min(MAX_CANTIDAD, valor));
    setLineas((prev) => {
      const existe = prev.some((l) => l.productoId === productoId);
      if (cantidad === 0) return prev.filter((l) => l.productoId !== productoId);
      if (existe) return prev.map((l) => (l.productoId === productoId ? { ...l, cantidad } : l));
      return prev.length >= MAX_LINEAS ? prev : [...prev, { productoId, cantidad }];
    });
  };

  const productosPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const grupos = useMemo(() => {
    const term = normalizeSearchText(query.trim());
    // Si lo escrito son solo números se busca por código (que empiece así) o en la descripción
    const soloNumeros = /^\d+$/.test(term);
    const coincide = (p) =>
      soloNumeros
        ? String(p.codigo).startsWith(term) || normalizeSearchText(p.descripcion).includes(term)
        : [p.codigo, p.descripcion, p.categoria].some((v) => normalizeSearchText(v).includes(term));
    const filtrados = productos.filter((p) =>
      (!categoria || p.categoria === categoria) &&
      (!term || coincide(p)),
    );
    const porCategoria = new Map();
    filtrados.forEach((p) => {
      if (!porCategoria.has(p.categoria)) porCategoria.set(p.categoria, []);
      porCategoria.get(p.categoria).push(p);
    });
    return [...porCategoria.entries()];
  }, [categoria, productos, query]);

  const categorias = useMemo(() => [...new Set(productos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'es')), [productos]);

  const detalle = lineas.map((l) => {
    const p = productosPorId.get(l.productoId);
    const valor = precioOriginal.get(l.productoId) ?? p?.valor ?? 0;
    return { ...l, descripcion: p?.descripcion ?? '', valor, subtotal: l.cantidad * valor };
  });
  const total = detalle.reduce((acc, l) => acc + l.subtotal, 0);
  const numeroValido = Number.isInteger(Number(numero)) && Number(numero) >= 1 && Number(numero) <= 2147483647;
  const puedeGuardar = Boolean(caso) && lineas.length > 0 && Boolean(fecha) && numeroValido && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    if (editando) {
      await onSubmit({
        tipo,
        numero: Number(numero),
        fecha,
        noOrden: noOrden.trim() || undefined,
        doctorNombre,
        pacienteNombre,
        items: lineas,
      });
      return;
    }
    await onSubmit({
      casoId: caso.id,
      tipo,
      numero: Number(numero),
      fecha,
      noOrden: noOrden.trim() || undefined,
      items: lineas,
    });
  };

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="rem-tipo">Tipo de remisión</label>
          <select id="rem-tipo" className={styles.select} value={tipo} disabled={saving} onChange={(e) => {
            setTipo(e.target.value);
            if (!editando) {
              setNumero('');
              setNumeroError('');
              setNumeroConsultado(false);
            }
          }}>
            <option value="NORMAL">Cuenta de cobro</option>
            <option value="ELECTRONICA">Electrónica (FE-)</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="rem-numero">
            N° de remisión {tipo === 'ELECTRONICA' && '(FE-)'} <span className={styles.required}>*</span>
          </label>
          <input
            id="rem-numero"
            className={styles.input}
            type="number"
            min="1"
            max="2147483647"
            step="1"
            required
            value={numero}
            disabled={saving}
            onChange={(e) => {
              setNumero(e.target.value);
            }}
          />
          {editando && <small className={styles.numberHelp}>El número debe ser único dentro de la serie elegida.</small>}
          {!numero && numeroConsultado && primeraRemision && (
            <small className={styles.numberHelp}>Escribe el número de la primera remisión; las siguientes continuarán desde ahí</small>
          )}
          {numeroError && <small className={styles.numberError} role="alert">{numeroError}</small>}
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.label}>
            Caso <span className={styles.required}>*</span>
          </span>
          <CasePicker casos={casos} selected={caso} onSelect={setCaso} locked={editando} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="rem-fecha">
            Fecha <span className={styles.required}>*</span>
          </label>
          <input id="rem-fecha" className={styles.input} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="rem-orden">
            No. de orden
          </label>
          <input
            id="rem-orden"
            className={styles.input}
            value={noOrden}
            onChange={(e) => setNoOrden(e.target.value)}
            maxLength={60}
            autoComplete="off"
            placeholder={caso ? `Por defecto: ${caso.codigo}` : 'Por defecto: código del caso'}
          />
        </div>

        {editando && (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rem-doctor">Doctor(a) (como sale impreso)</label>
              <input id="rem-doctor" className={styles.input} value={doctorNombre} onChange={(e) => setDoctorNombre(e.target.value)} maxLength={150} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="rem-paciente">Paciente (como sale impreso)</label>
              <input id="rem-paciente" className={styles.input} value={pacienteNombre} onChange={(e) => setPacienteNombre(e.target.value)} maxLength={150} />
            </div>
          </>
        )}

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.label}>
            Productos <span className={styles.required}>*</span>{' '}
            <span className={styles.lineCounter}>
              · escribe la cantidad de cada uno ({lineas.length}/{MAX_LINEAS} productos)
            </span>
          </span>
          <div className={styles.pickerBox}>
            <div className={styles.pickerBar}>
              <SearchField
                className={styles.pickerSearch}
                value={query}
                onChange={setQuery}
                placeholder="Buscar por código o descripción"
                label="Buscar producto por código o descripción"
              />
              {onNuevoProducto && (
                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.pickerAdd}`}
                  onClick={onNuevoProducto}
                  disabled={saving}
                  title="Crear un producto nuevo en la lista de precios"
                >
                  <Icon name="plus" size={14} /> Nuevo producto
                </button>
              )}
              <select
                className={`${styles.select} ${styles.pickerCategory}`}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                aria-label="Filtrar por categoría"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
              </select>
            </div>
            <div className={styles.productList}>
              {productos.length === 0 && (
                <div className={styles.pickerEmpty}>
                  No hay productos activos. Agrégalos con el botón <strong>Nuevo producto</strong> o actívalos desde la opción <strong>Productos</strong>.
                </div>
              )}
              {productos.length > 0 && grupos.length === 0 && (
                <div className={styles.pickerEmpty}>Ningún producto coincide con la búsqueda.</div>
              )}
              {grupos.map(([categoria, items]) => (
                <div key={categoria}>
                  <div className={styles.categoryHead}>{categoria}</div>
                  {items.map((p) => {
                    const cantidad = cantidadDe(p.id);
                    const sinPrecio = p.valor <= 0;
                    const bloqueado = sinPrecio || (llena && cantidad === 0);
                    return (
                      <div
                        key={p.id}
                        className={`${styles.productRow} ${cantidad > 0 ? styles.productRowActive : ''} ${sinPrecio ? styles.productRowDisabled : ''}`}
                        title={!sinPrecio && bloqueado ? `Máximo ${MAX_LINEAS} productos por remisión` : undefined}
                      >
                        <span className={styles.code}>{p.codigo}</span>
                        <span className={styles.productName}>{p.descripcion}</span>
                        <span className={`${styles.price} ${sinPrecio ? styles.noPrice : ''}`}>
                          {sinPrecio ? 'Sin precio en la lista' : formatMoney(precioOriginal.get(p.id) ?? p.valor)}
                        </span>
                        <QuantityControl value={cantidad} onChange={(n) => setCantidad(p.id, n)} disabled={bloqueado} label={p.descripcion} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {detalle.length > 0 && (
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.label}>Resumen de la remisión</span>
            <div className={styles.summary}>
              {detalle.map((l) => (
                <div key={l.productoId} className={styles.summaryRow}>
                  <strong>{l.cantidad}×</strong>
                  <span className={styles.productName}>{l.descripcion}</span>
                  <span className={styles.price}>{formatMoney(l.subtotal)}</span>
                  <button type="button" className={styles.removeBtn} onClick={() => setCantidad(l.productoId, 0)}>
                    Quitar
                  </button>
                </div>
              ))}
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className={styles.primaryBtn} disabled={!puedeGuardar}>
          <Icon name="download" size={16} />{' '}
          {saving ? (editando ? 'Guardando…' : 'Generando…') : editando ? 'Guardar corrección' : 'Crear remisión'}
        </button>
      </div>
    </form>
  );
}
