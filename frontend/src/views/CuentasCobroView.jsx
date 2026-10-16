import { useMemo, useState } from 'react';
import styles from '../styles/app.module.css';
import { useResource } from '../hooks/useResource.js';
import { cuentasService } from '../services/cuentas.service.js';
import { formatMoney } from '../utils/format.js';
import { matchesSearch } from '../utils/search.js';
import CuentaCobroModal from './components/CuentaCobroModal.jsx';
import DataTable from './components/DataTable.jsx';
import { FilterBar, MESES, PeriodFilter, SearchField, SelectFilter } from './components/filters.jsx';
import { Badge, contar, Panel } from './components/ui.jsx';

const ESTADOS_PAGO = ['Todos', 'Pendiente', 'Pago parcial', 'Pagada'];

const estadoDe = (c) => (c.pagada ? 'Pagada' : c.pagadas > 0 ? 'Pago parcial' : 'Pendiente');
const TONO_ESTADO = { Pagada: 'done', 'Pago parcial': 'progress', Pendiente: 'lab' };

/** Cuenta de estado = remisiones (no anuladas) de cada cliente en el mes. Al abrir un cliente se marca cuáles están pagadas. */
export default function CuentasCobroView({ showToast }) {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const { anio, mes } = periodo;
  const { data: cuentas, loading, error, reload: load } = useResource(() => cuentasService.list(anio, mes), [anio, mes]);
  const [guardando, setGuardando] = useState(false);
  const [abierta, setAbierta] = useState(null); // clienteId de la cuenta abierta en el modal
  const [busqueda, setBusqueda] = useState('');
  const [estadoPago, setEstadoPago] = useState('Todos');

  const cambiarPeriodo = (nuevoAnio, nuevoMes) => {
    setPeriodo({ anio: nuevoAnio, mes: nuevoMes });
    setAbierta(null);
  };

  const resumen = useMemo(() => {
    const total = cuentas.reduce((a, c) => a + c.total, 0);
    const pagado = cuentas.reduce((a, c) => a + c.totalPagado, 0);
    return { total, pagado, pendiente: total - pagado };
  }, [cuentas]);

  const visibles = useMemo(
    () => cuentas.filter((c) => (estadoPago === 'Todos' || estadoDe(c) === estadoPago) && matchesSearch(busqueda, [c.cliente])),
    [cuentas, busqueda, estadoPago],
  );

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

  const columnas = [
    {
      key: 'cliente',
      header: 'Cliente',
      render: (c) => (
        <button
          type="button"
          className={styles.linkBtn}
          onClick={(e) => { e.stopPropagation(); setAbierta(c.clienteId); }}
          aria-label={`Ver remisiones de ${c.cliente}`}
        >
          {c.cliente}
        </button>
      ),
    },
    { key: 'remisiones', header: 'Remisiones', align: 'right', render: (c) => c.remisiones.length },
    { key: 'pendiente', header: 'Pendiente', align: 'right', className: styles.moneyCell, render: (c) => formatMoney(c.total - c.totalPagado) },
    { key: 'pagado', header: 'Pagado', align: 'right', className: styles.moneyCell, render: (c) => formatMoney(c.totalPagado) },
    { key: 'total', header: 'Total', align: 'right', className: styles.moneyCell, render: (c) => formatMoney(c.total) },
    { key: 'pagadas', header: 'Pagadas', render: (c) => `${c.pagadas} de ${c.remisiones.length}` },
    { key: 'estado', header: 'Estado', render: (c) => <Badge tone={TONO_ESTADO[estadoDe(c)]}>{estadoDe(c)}</Badge> },
  ];

  return (
    <>
      <div className={styles.kpis}>
        <div className={styles.kpi}><span>Total de remisiones en {MESES[mes - 1].toLowerCase()}</span><strong>{formatMoney(resumen.total)}</strong></div>
        <div className={styles.kpi}><span>Pagado</span><strong>{formatMoney(resumen.pagado)}</strong></div>
        <div className={styles.kpi}><span>Pendiente de cobro</span><strong>{formatMoney(resumen.pendiente)}</strong></div>
      </div>

      <Panel title={`Cuenta de estado · ${MESES[mes - 1]} ${anio}`} meta={contar(visibles.length, 'cliente', 'clientes', loading)}>
        <FilterBar>
          <SearchField value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente" label="Buscar cliente" />
          <PeriodFilter anio={anio} mes={mes} onChange={cambiarPeriodo} flechas />
          <SelectFilter
            value={estadoPago}
            onChange={setEstadoPago}
            options={ESTADOS_PAGO.map((e) => ({ value: e, label: e === 'Todos' ? 'Todos los estados' : e }))}
            label="Filtrar por estado de pago"
          />
        </FilterBar>

        <DataTable
          columns={columnas}
          rows={visibles}
          rowKey={(c) => c.clienteId}
          onRowClick={(c) => setAbierta(c.clienteId)}
          rowLabel={(c) => `Ver remisiones de ${c.cliente}`}
          loading={loading}
          loadingText="Cargando cuenta de estado…"
          error={error}
          onRetry={load}
          empty={cuentas.length === 0
            ? { title: 'No hay remisiones en este mes', children: 'Cambia de mes con las flechas.' }
            : { title: 'Ningún cliente coincide', children: 'Cambia la búsqueda o el estado de pago.' }}
        />
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
