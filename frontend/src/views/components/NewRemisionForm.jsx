import { useEffect, useMemo, useState } from 'react';
import styles from '../dashboard.module.css';
import r from '../remisiones.module.css';
import { formatMoney } from '../../utils/format.js';
import { Icon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';
import { remisionesService } from '../../services/remisiones.service.js';

const MAX_LINEAS = 9; // lo que cabe en el formato de remisión del laboratorio
const MAX_CANTIDAD = 999;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const normalize = (text) =>
  String(text ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function CasePicker({ casos, selected, onSelect, locked = false }) {
  const [query, setQuery] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const matches = useMemo(() => {
    const term = normalize(query.trim());
    const list = casos.filter((c) => {
      const fecha = String(c.fechaIngreso ?? c.creadoEn ?? '').slice(0, 10);
      return (!desde || fecha >= desde) && (!hasta || fecha <= hasta) &&
        (!term || [c.codigo, c.titulo, c.cliente?.nombre, c.pacienteNombre].some((v) => normalize(v).includes(term)));
    });
    return list.slice(0, 50);
  }, [casos, desde, hasta, query]);

  if (selected) {
    return (
      <div className={r.selectedCase}>
        <div className={r.pickerItemMain}>
          <div className={r.pickerItemTitle}>
            <span className={r.code}>{selected.codigo}</span> · {selected.titulo}
          </div>
          <div className={r.pickerItemMeta}>
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
    <div className={r.pickerBox}>
      <label className={r.pickerSearch}>
        <Icon name="search" size={17} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por código, título, cliente o paciente"
          aria-label="Buscar caso"
          autoFocus
        />
      </label>
      <div className={r.pickerFilters}>
        <label>
          <span>Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Filtrar casos desde" />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Filtrar casos hasta" />
        </label>
      </div>
      {matches.length === 0 ? (
        <div className={r.pickerEmpty}>
          {casos.length === 0 ? 'Aún no hay casos registrados.' : 'Ningún caso coincide con los filtros.'}
        </div>
      ) : (
        <ul className={r.pickerList}>
          {matches.map((caso) => (
            <li key={caso.id}>
              <button type="button" className={r.pickerItem} onClick={() => onSelect(caso)}>
                <div className={r.pickerItemMain}>
                  <div className={r.pickerItemTitle}>
                    <span className={r.code}>{caso.codigo}</span> · {caso.titulo}
                  </div>
                  <div className={r.pickerItemMeta}>
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
    <div className={r.qty}>
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
 * Crea una remisión nueva o, si se pasa `remision`, la corrige: el número y el caso no cambian,
 * los productos que ya estaban conservan su precio y los nuevos toman el precio vigente.
 */
export default function NewRemisionForm({ casos, productos: productosActivos, saving, onSubmit, onCancel, remision }) {
  const editando = Boolean(remision);
  const [caso, setCaso] = useState(remision?.caso ?? null);
  const [fecha, setFecha] = useState(remision ? String(remision.fecha).slice(0, 10) : today);
  const [noOrden, setNoOrden] = useState(remision?.noOrden ?? '');
  const [doctorNombre, setDoctorNombre] = useState(remision?.doctorNombre ?? remision?.caso?.cliente?.nombre ?? '');
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
    remisionesService.siguienteNumero().then(
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
  }, [editando]);

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
    const term = normalize(query.trim());
    const filtrados = productos.filter((p) =>
      (!categoria || p.categoria === categoria) &&
      (!term || [p.codigo, p.descripcion, p.categoria].some((v) => normalize(v).includes(term))),
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
  const puedeGuardar = Boolean(caso) && lineas.length > 0 && Boolean(fecha) && (editando || numeroValido) && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    if (editando) {
      await onSubmit({
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
          <label className={styles.label} htmlFor="rem-numero">
            N° de remisión <span className={styles.required}>*</span>
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
            disabled={editando}
            onChange={(e) => {
              setNumero(e.target.value);
            }}
          />
          {editando && <small className={r.numberHelp}>El número no se puede cambiar: si quedó mal, anula la remisión y crea otra.</small>}
          {!numero && numeroConsultado && primeraRemision && (
            <small className={r.numberHelp}>Escribe el número de la primera remisión; las siguientes continuarán desde ahí</small>
          )}
          {numeroError && <small className={r.numberError} role="alert">{numeroError}</small>}
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
              <label className={styles.label} htmlFor="rem-doctor">Doctor(a) / clínica (como sale impreso)</label>
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
            <span className={r.lineCounter}>
              · escribe la cantidad de cada uno ({lineas.length}/{MAX_LINEAS} productos)
            </span>
          </span>
          <div className={r.pickerBox}>
            <label className={r.pickerSearch}>
              <Icon name="search" size={17} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto por código o descripción"
                aria-label="Buscar producto"
              />
            </label>
            <div className={r.productFilters}>
              <label htmlFor="rem-categoria">Categoría</label>
              <select id="rem-categoria" className={styles.input} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas las categorías</option>
                {categorias.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
              </select>
            </div>
            <div className={r.productList}>
              {productos.length === 0 && (
                <div className={r.pickerEmpty}>
                  No hay productos activos. Agrega o activa productos desde la opción <strong>Productos</strong>.
                </div>
              )}
              {productos.length > 0 && grupos.length === 0 && (
                <div className={r.pickerEmpty}>Ningún producto coincide con la búsqueda.</div>
              )}
              {grupos.map(([categoria, items]) => (
                <div key={categoria}>
                  <div className={r.categoryHead}>{categoria}</div>
                  {items.map((p) => {
                    const cantidad = cantidadDe(p.id);
                    const sinPrecio = p.valor <= 0;
                    const bloqueado = sinPrecio || (llena && cantidad === 0);
                    return (
                      <div
                        key={p.id}
                        className={`${r.productRow} ${cantidad > 0 ? r.productRowActive : ''} ${sinPrecio ? r.productRowDisabled : ''}`}
                        title={!sinPrecio && bloqueado ? `Máximo ${MAX_LINEAS} productos por remisión` : undefined}
                      >
                        <span className={r.code}>{p.codigo}</span>
                        <span className={r.productName}>{p.descripcion}</span>
                        <span className={`${r.price} ${sinPrecio ? r.noPrice : ''}`}>
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
            <div className={r.summary}>
              {detalle.map((l) => (
                <div key={l.productoId} className={r.summaryRow}>
                  <strong>{l.cantidad}×</strong>
                  <span className={r.productName}>{l.descripcion}</span>
                  <span className={r.price}>{formatMoney(l.subtotal)}</span>
                  <button type="button" className={r.removeBtn} onClick={() => setCantidad(l.productoId, 0)}>
                    Quitar
                  </button>
                </div>
              ))}
              <div className={r.summaryTotal}>
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
          {saving ? (editando ? 'Guardando…' : 'Generando…') : editando ? 'Guardar corrección' : 'Crear remisión y descargar Excel'}
        </button>
      </div>
    </form>
  );
}
