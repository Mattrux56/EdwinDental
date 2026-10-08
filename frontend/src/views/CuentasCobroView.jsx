import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './dashboard.module.css';
import r from './remisiones.module.css';
import { cuentasService } from '../services/cuentas.service.js';
import { formatMoney } from '../utils/format.js';
import { Icon } from './components/Icon.jsx';
import CuentaCobroModal from './components/CuentaCobroModal.jsx';
import { EmptyState, ErrorBanner, PageHeader, Panel, SearchField } from './components/ui.jsx';
import { normalizeSearchText } from '../utils/search.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ESTADOS_PAGO = ['Todos', 'Pendiente', 'Pago parcial', 'Pagada'];

const estadoDe = (c) => (c.pagada ? 'Pagada' : c.pagadas > 0 ? 'Pago parcial' : 'Pendiente');
/** Cuenta de cobro = remisiones (no anuladas) de cada cliente en el mes. Al abrir un cliente se marca cuáles están pagadas. */
export default function CuentasCobroView({ showToast }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [abierta, setAbierta] = useState(null); // clienteId de la cuenta abierta en el modal
  const [anioTexto, setAnioTexto] = useState(String(hoy.getFullYear()));
  const [busqueda, setBusqueda] = useState('');
  const [estadoPago, setEstadoPago] = useState('Todos');
  const pedido = useRef(0);

  const load = useCallback(async () => {
    const mio = ++pedido.current; // si cambias de mes rápido, solo cuenta la última respuesta
    setLoading(true);
    setError('');
    try {
      const datos = await cuentasService.list(anio, mes);
      if (mio === pedido.current) setCuentas(datos);
    } catch (reason) {
      if (mio === pedido.current) {
        setCuentas([]);
        setError(reason.message);
      }
    } finally {
      if (mio === pedido.current) setLoading(false);
    }
  }, [anio, mes]);

  useEffect(() => {
    load();
  }, [load]);

  const mover = (delta) => {
    const total = anio * 12 + (mes - 1) + delta;
    const nuevoAnio = Math.floor(total / 12);
    if (nuevoAnio < 2000 || nuevoAnio > 2100) return;
    setAnio(nuevoAnio);
    setAnioTexto(String(nuevoAnio));
    setMes((total % 12) + 1);
    setAbierta(null);
  };

  const resumen = useMemo(() => {
    const total = cuentas.reduce((a, c) => a + c.total, 0);
    const pagado = cuentas.reduce((a, c) => a + c.totalPagado, 0);
    return { total, pagado, pendiente: total - pagado };
  }, [cuentas]);

  const visibles = useMemo(() => {
    const term = normalizeSearchText(busqueda.trim());
    return cuentas.filter((c) => (estadoPago === 'Todos' || estadoDe(c) === estadoPago) && (!term || normalizeSearchText(c.cliente).includes(term)));
  }, [cuentas, busqueda, estadoPago]);

  const cuentaAbierta = cuentas.find((c) => c.clienteId === abierta) ?? null;

  const confirmar = async (pagadas) => {
    setGuardando(true);
    try {
      await cuentasService.guardarPagos(cuentaAbierta.clienteId, anio, mes, pagadas);
      showToast('success', `Pagos de ${cuentaAbierta.cliente} guardados`);
      setAbierta(null);
    } catch (reason) {
      showToast('error', reason.message);
    } finally {
      setGuardando(false);
      await load();
    }
  };

  return (
    <>
      <PageHeader
        title="Cuentas de cobro"
        subtitle="Total mensual por cliente según sus remisiones. Abre un cliente para marcar cuáles están pagadas. Las anuladas no se cuentan."
      />

      <div className={r.kpis}>
        <div className={r.kpi}><span>Total de remisiones en {MESES[mes - 1].toLowerCase()}</span><strong>{formatMoney(resumen.total)}</strong></div>
        <div className={r.kpi}><span>Pagado</span><strong>{formatMoney(resumen.pagado)}</strong></div>
        <div className={r.kpi}><span>Pendiente de cobro</span><strong>{formatMoney(resumen.pendiente)}</strong></div>
      </div>

      <Panel
        title={`${MESES[mes - 1]} ${anio}`}
        meta={loading ? 'Cargando…' : `${visibles.length} ${visibles.length === 1 ? 'cliente' : 'clientes'}`}
      >

        <div className={r.cuentaToolbar}>
          <div className={r.periodControl}>
            <button type="button" className={styles.secondaryBtn} onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
            <select className={styles.select} value={mes} onChange={(e) => { setMes(Number(e.target.value)); setAbierta(null); }} aria-label="Mes">
              {MESES.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)}
            </select>
            <input
              className={styles.input}
              type="number"
              min="2000"
              max="2100"
              value={anioTexto}
              onChange={(e) => {
                setAnioTexto(e.target.value);
                const v = Number(e.target.value);
                if (Number.isInteger(v) && v >= 2000 && v <= 2100) { setAnio(v); setAbierta(null); }
              }}
              onBlur={() => setAnioTexto(String(anio))}
              aria-label="Año"
            />
            <button type="button" className={styles.secondaryBtn} onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
          </div>
          <SearchField value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente" label="Buscar cliente" />
          <select className={styles.select} value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)} aria-label="Filtrar por estado de pago">
            {ESTADOS_PAGO.map((e) => <option key={e} value={e}>{e === 'Todos' ? 'Todos los estados' : e}</option>)}
          </select>
        </div>

        {error && <ErrorBanner onRetry={load}>{error}</ErrorBanner>}
        {!loading && !error && cuentas.length === 0 && (
          <EmptyState title="No hay remisiones en este mes">Cambia de mes con las flechas.</EmptyState>
        )}
        {!loading && !error && cuentas.length > 0 && visibles.length === 0 && (
          <EmptyState title="Ningún cliente coincide">Cambia la búsqueda o el estado de pago.</EmptyState>
        )}

        {visibles.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th style={{ textAlign: 'right' }}>Remisiones</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Pagadas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr key={c.clienteId} className={r.clienteRow} onClick={() => setAbierta(c.clienteId)}>
                    <td>
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={(e) => { e.stopPropagation(); setAbierta(c.clienteId); }}
                        aria-label={`Ver remisiones de ${c.cliente}`}
                      >
                        {c.cliente}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>{c.remisiones.length}</td>
                    <td className={r.moneyCell}>{formatMoney(c.total)}</td>
                    <td>{c.pagadas} de {c.remisiones.length}</td>
                    <td>
                      <span className={`${styles.badge} ${c.pagada ? styles.badgeDone : c.pagadas > 0 ? styles.badgeProgress : styles.badgeLab}`}>
                        {estadoDe(c)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {cuentaAbierta && (
        <CuentaCobroModal
          key={cuentaAbierta.clienteId}
          cuenta={cuentaAbierta}
          periodo={`${MESES[mes - 1].toLowerCase()} de ${anio}`}
          saving={guardando}
          onClose={() => setAbierta(null)}
          onConfirm={confirmar}
        />
      )}
    </>
  );
}
