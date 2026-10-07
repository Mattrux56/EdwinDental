import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './dashboard.module.css';
import r from './remisiones.module.css';
import { cuentasService } from '../services/cuentas.service.js';
import { remisionesService } from '../services/remisiones.service.js';
import { formatEstimatedDate, formatMoney } from '../utils/format.js';
import { Icon } from './components/Icon.jsx';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Cuenta de cobro = remisiones (no anuladas) de cada cliente en el mes. El pago se marca por remisión o todas a la vez. */
export default function CuentasCobroView({ showToast }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [anioTexto, setAnioTexto] = useState(String(hoy.getFullYear()));
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

  /** Marca o desmarca todas las remisiones del cliente en el mes */
  const marcarTodas = async (cuenta, pagada) => {
    setBusyId(`c${cuenta.clienteId}`);
    try {
      await cuentasService.marcarPago(cuenta.clienteId, anio, mes, pagada);
      showToast('success', pagada ? 'Todas las remisiones quedaron pagadas' : 'Todas las remisiones quedaron pendientes');
      await load();
    } catch (reason) {
      showToast('error', reason.message);
    } finally {
      setBusyId(null);
    }
  };

  /** Marca o desmarca una sola remisión (se ve al instante y se confirma con el servidor) */
  const marcarUna = async (remision, pagada) => {
    setBusyId(`r${remision.id}`);
    setCuentas((actuales) => actuales.map((c) => {
      if (!c.remisiones.some((x) => x.id === remision.id)) return c;
      const remisiones = c.remisiones.map((x) => (x.id === remision.id ? { ...x, pagada } : x));
      const pagadas = remisiones.filter((x) => x.pagada).length;
      const totalPagado = remisiones.filter((x) => x.pagada).reduce((acc, x) => acc + x.total, 0);
      return { ...c, remisiones, pagadas, totalPagado, pagada: pagadas === remisiones.length };
    }));
    try {
      await remisionesService.marcarPago(remision.id, pagada);
    } catch (reason) {
      showToast('error', reason.message);
    } finally {
      await load(); // deja la pantalla igual que el servidor, haya salido bien o mal
      setBusyId(null);
    }
  };

  return (
    <>
      <header className={styles.appHeader}>
        <div>
          <h1 className={styles.pageTitle}>Cuentas de cobro</h1>
          <p className={styles.pageSubtitle}>Total mensual por cliente según sus remisiones. Marca cuáles están pagadas, o todas a la vez. Las anuladas no se cuentan.</p>
        </div>
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
      </header>

      <div className={r.kpis}>
        <div className={r.kpi}><span>Facturado en {MESES[mes - 1].toLowerCase()}</span><strong>{formatMoney(resumen.total)}</strong></div>
        <div className={r.kpi}><span>Pagado</span><strong>{formatMoney(resumen.pagado)}</strong></div>
        <div className={r.kpi}><span>Pendiente de cobro</span><strong>{formatMoney(resumen.pendiente)}</strong></div>
      </div>

      <section className={`${styles.panel} ${styles.panelFill}`}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>{MESES[mes - 1]} {anio}</h2>
          <span className={styles.panelMeta}>{loading ? 'Cargando…' : `${cuentas.length} ${cuentas.length === 1 ? 'cliente' : 'clientes'}`}</span>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <span>{error}</span>
            <button type="button" className={styles.secondaryBtn} onClick={load}><Icon name="refresh" size={16} /> Reintentar</button>
          </div>
        )}
        {!loading && !error && cuentas.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No hay remisiones en este mes</p>
            <span>Cambia de mes con las flechas.</span>
          </div>
        )}

        {cuentas.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th style={{ textAlign: 'right' }}>Remisiones</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Pagadas</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <Fragment key={c.clienteId}>
                    <tr>
                      <td>
                        <button type="button" className={styles.linkBtn} onClick={() => setAbierta(abierta === c.clienteId ? null : c.clienteId)} aria-expanded={abierta === c.clienteId}>
                          {abierta === c.clienteId ? '▾' : '▸'} {c.cliente}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>{c.remisiones.length}</td>
                      <td className={r.moneyCell}>{formatMoney(c.total)}</td>
                      <td>{c.pagadas} de {c.remisiones.length}</td>
                      <td>
                        <span className={`${styles.badge} ${c.pagada ? styles.badgeDone : c.pagadas > 0 ? styles.badgeProgress : styles.badgeLab}`}>
                          {c.pagada ? 'Pagada' : c.pagadas > 0 ? 'Pago parcial' : 'Pendiente'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.productActions}>
                          {c.pagada ? (
                            <button type="button" className={styles.secondaryBtn} onClick={() => marcarTodas(c, false)} disabled={busyId === `c${c.clienteId}`}>
                              Marcar todas pendientes
                            </button>
                          ) : (
                            <button type="button" className={styles.primaryBtn} onClick={() => marcarTodas(c, true)} disabled={busyId === `c${c.clienteId}`}>
                              {c.remisiones.length > 1 ? 'Marcar todas pagadas' : 'Marcar pagada'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {abierta === c.clienteId && (
                      <tr>
                        <td colSpan={6} className={r.detailCell}>
                          <table className={r.miniTable}>
                            <thead>
                              <tr><th>Pagada</th><th>N°</th><th>Fecha</th><th>Paciente</th><th>Orden</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
                            </thead>
                            <tbody>
                              {c.remisiones.map((x) => (
                                <tr key={x.id}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      className={r.checkPago}
                                      checked={x.pagada}
                                      onChange={(e) => marcarUna(x, e.target.checked)}
                                      disabled={busyId === `r${x.id}` || busyId === `c${c.clienteId}`}
                                      aria-label={`Remisión ${x.numero} pagada`}
                                    />
                                  </td>
                                  <td>{x.numero}</td>
                                  <td>{formatEstimatedDate(x.fecha)}</td>
                                  <td>{x.paciente || '—'}</td>
                                  <td>{x.noOrden || '—'}</td>
                                  <td style={{ textAlign: 'right' }}>{formatMoney(x.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
