import { useEffect, useMemo, useState } from 'react';
import styles from '../../styles/app.module.css';
import { formatMoney } from '../../utils/format.js';
import { Icon } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';
import { DateFilter, SearchField } from './filters.jsx';
import { esProtesis } from '../../utils/protesis.js';
import { matchesSearch, normalizeSearchText } from '../../utils/search.js';
import { remisionesService } from '../../services/remisiones.service.js';

const MAX_LINEAS = 8; // lo que cabe en el formato de remisión del laboratorio
const MAX_CANTIDAD = 999;

// En edición, un producto que ya no está activo trae su propia marca `protesis` (su categoría real no se conserva)
const esProductoProtesis = (p) => Boolean(p) && (p.protesis ?? esProtesis(p.categoria));

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

/** Reparto opcional de una prótesis: dos píldoras (superior / inferior) con su cantidad y su casilla */
function SplitFields({ linea, descripcion, saving, onMarcar, onValor }) {
  const invalido = (linea.supOn || linea.infOn) && linea.sup + linea.inf !== linea.cantidad;
  return (
    <div className={styles.splitFields} role="group" aria-label={`Superiores e inferiores: ${descripcion}`}>
      {[['sup', 'Superior'], ['inf', 'Inferior']].map(([lado, texto]) => {
        const marcado = linea[`${lado}On`];
        const conError = marcado && invalido;
        return (
          <label
            key={lado}
            className={`${styles.splitItem} ${marcado ? styles.splitItemOn : ''} ${conError ? styles.splitItemError : ''}`}
            title={conError ? `Superiores más inferiores deben sumar ${linea.cantidad}` : undefined}
          >
            <input
              type="number"
              min="0"
              max={linea.cantidad}
              inputMode="numeric"
              value={marcado ? linea[lado] : ''}
              placeholder="0"
              disabled={!marcado || saving}
              onChange={(e) => onValor(linea.productoId, lado, Number.parseInt(e.target.value, 10) || 0)}
              aria-label={`Cantidad ${texto.toLowerCase()}: ${descripcion}`}
              aria-invalid={conError || undefined}
            />
            <span className={styles.splitCheck}>
              <input
                type="checkbox"
                checked={marcado}
                disabled={saving}
                onChange={(e) => onMarcar(linea.productoId, lado, e.target.checked)}
              />
              {texto}
            </span>
          </label>
        );
      })}
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
    () => remision?.items.filter((i) => i.productoId !== null).map((i) => ({
      productoId: i.productoId,
      cantidad: i.cantidad,
      sup: i.cantidadSuperior ?? 0,
      inf: i.cantidadInferior ?? 0,
      supOn: (i.cantidadSuperior ?? 0) > 0,
      infOn: (i.cantidadInferior ?? 0) > 0,
    })) ?? [],
  ); // [{ productoId, cantidad, sup, inf, supOn, infOn }] en el orden en que se eligieron (sup/inf solo cuentan en las prótesis)
  const [repartoAbierto, setRepartoAbierto] = useState(null); // línea del resumen cuyo reparto sup/inf se está editando
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
      .map((i) => ({
        id: i.productoId,
        codigo: '—',
        categoria: 'Ya en esta remisión',
        descripcion: i.descripcion,
        valor: i.valorUnitario,
        protesis: (i.cantidadSuperior ?? 0) + (i.cantidadInferior ?? 0) > 0, // la categoría real ya no se conoce
      }));
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

  // Con un solo lado marcado se lleva toda la cantidad; con los dos, lo que sobra del superior va al inferior
  const repartir = (l, cantidad) => {
    if (l.supOn && !l.infOn) return { ...l, cantidad, sup: cantidad, inf: 0 };
    if (l.infOn && !l.supOn) return { ...l, cantidad, sup: 0, inf: cantidad };
    if (l.supOn && l.infOn) {
      const sup = Math.min(l.sup, cantidad);
      return { ...l, cantidad, sup, inf: cantidad - sup };
    }
    return { ...l, cantidad, sup: 0, inf: 0 };
  };

  const setCantidad = (productoId, valor) => {
    const cantidad = Math.max(0, Math.min(MAX_CANTIDAD, valor));
    setLineas((prev) => {
      const existe = prev.some((l) => l.productoId === productoId);
      if (cantidad === 0) return prev.filter((l) => l.productoId !== productoId);
      if (existe) return prev.map((l) => (l.productoId === productoId ? repartir(l, cantidad) : l));
      return prev.length >= MAX_LINEAS ? prev : [...prev, { productoId, cantidad, sup: 0, inf: 0, supOn: false, infOn: false }];
    });
  };

  const cambiarLinea = (productoId, cambio) =>
    setLineas((prev) => prev.map((l) => (l.productoId === productoId ? cambio(l) : l)));

  /** Marca o desmarca superior (lado 'sup') o inferior (lado 'inf') de una prótesis */
  const marcarLado = (productoId, lado, activo) =>
    cambiarLinea(productoId, (l) => {
      const otro = lado === 'sup' ? 'inf' : 'sup';
      const nuevo = { ...l, [`${lado}On`]: activo };
      if (!activo) return repartir({ ...nuevo, [lado]: 0 }, l.cantidad);
      return { ...nuevo, [lado]: l[`${otro}On`] ? Math.max(l.cantidad - l[otro], 0) : l.cantidad, [otro]: l[`${otro}On`] ? l[otro] : 0 };
    });

  const setLado = (productoId, lado, valor) =>
    cambiarLinea(productoId, (l) => ({ ...l, [lado]: Math.max(0, Math.min(l.cantidad, valor)) }));

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
    return { ...l, descripcion: p?.descripcion ?? '', valor, subtotal: l.cantidad * valor, protesis: esProductoProtesis(p) };
  });
  const total = detalle.reduce((acc, l) => acc + l.subtotal, 0);
  const numeroValido = Number.isInteger(Number(numero)) && Number(numero) >= 1 && Number(numero) <= 2147483647;
  // El reparto es opcional, pero si en una prótesis se marcó una casilla, superiores + inferiores deben dar la cantidad
  const repartoInvalido = (l) => l.protesis && (l.supOn || l.infOn) && l.sup + l.inf !== l.cantidad;
  const repartoIncompleto = detalle.some(repartoInvalido);
  const puedeGuardar = Boolean(caso) && lineas.length > 0 && Boolean(fecha) && numeroValido && !repartoIncompleto && !saving;

  const itemsPayload = detalle.map((l) => ({
    productoId: l.productoId,
    cantidad: l.cantidad,
    cantidadSuperior: l.protesis ? l.sup : 0,
    cantidadInferior: l.protesis ? l.inf : 0,
  }));

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
        items: itemsPayload,
      });
      return;
    }
    await onSubmit({
      casoId: caso.id,
      tipo,
      numero: Number(numero),
      fecha,
      noOrden: noOrden.trim() || undefined,
      items: itemsPayload,
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
                    const linea = lineas.find((l) => l.productoId === p.id);
                    const reparto = linea && esProductoProtesis(p) ? linea : null;
                    return (
                      <div
                        key={p.id}
                        className={`${styles.productRow} ${reparto ? styles.productRowSplit : ''} ${cantidad > 0 ? styles.productRowActive : ''} ${sinPrecio ? styles.productRowDisabled : ''}`}
                        title={!sinPrecio && bloqueado ? `Máximo ${MAX_LINEAS} productos por remisión` : undefined}
                      >
                        <span className={styles.code}>{p.codigo}</span>
                        <span className={styles.productName}>{p.descripcion}</span>
                        {reparto && (
                          <SplitFields linea={reparto} descripcion={p.descripcion} saving={saving} onMarcar={marcarLado} onValor={setLado} />
                        )}
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
                  <span className={styles.productName}>
                    {l.descripcion}
                    {l.protesis && l.sup + l.inf > 0 && <span className={styles.hint}> · Sup. {l.sup} / Inf. {l.inf}</span>}
                  </span>
                  <span className={styles.price}>{formatMoney(l.subtotal)}</span>
                  <div className={styles.summaryActions}>
                    {editando && l.protesis && (
                      <button
                        type="button"
                        className={`${styles.editLineBtn} ${repartoInvalido(l) ? styles.editLineBtnError : ''}`}
                        onClick={() => setRepartoAbierto((actual) => (actual === l.productoId ? null : l.productoId))}
                        aria-expanded={repartoAbierto === l.productoId}
                      >
                        {repartoAbierto === l.productoId ? 'Listo' : 'Editar'}
                      </button>
                    )}
                    <button type="button" className={styles.removeBtn} onClick={() => setCantidad(l.productoId, 0)}>
                      Quitar
                    </button>
                  </div>
                  {editando && l.protesis && repartoAbierto === l.productoId && (
                    <div className={styles.summaryEdit}>
                      <QuantityControl value={l.cantidad} onChange={(n) => setCantidad(l.productoId, n)} disabled={saving} label={l.descripcion} />
                      <SplitFields linea={l} descripcion={l.descripcion} saving={saving} onMarcar={marcarLado} onValor={setLado} />
                    </div>
                  )}
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
        <button
          type="submit"
          className={styles.primaryBtn}
          disabled={!puedeGuardar}
          title={repartoIncompleto ? 'Revisa las prótesis: superiores más inferiores deben sumar la cantidad' : undefined}
        >
          <Icon name="download" size={16} />{' '}
          {saving ? (editando ? 'Guardando…' : 'Generando…') : editando ? 'Guardar corrección' : 'Crear remisión'}
        </button>
      </div>
    </form>
  );
}
