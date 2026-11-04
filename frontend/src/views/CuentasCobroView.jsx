import { useMemo, useState } from 'react';
import styles from '../styles/app.module.css';
import ds from '../styles/ds.module.css';
import { useResource } from '../hooks/useResource.js';
import { cuentasService } from '../services/cuentas.service.js';
import { formatMoney } from '../utils/format.js';
import { matchesSearch } from '../utils/search.js';
import CuentaCobroModal from './components/CuentaCobroModal.jsx';
import DataTable from './components/DataTable.jsx';
import { Field, Segmented } from './components/controls.jsx';
import { MESES, MonthFilter, SearchField } from './components/filters.jsx';
import { Button, contar, PagoBadge, Panel } from './components/ui.jsx';


const estadoDe = (c) => (c.pagada ? 'Pagada' : c.pagadas > 0 ? 'Pago parcial' : 'Pendiente');

/** Cuenta de estado = remisiones (no anuladas) de cada cliente en el mes. Al abrir un cliente se marca cuáles están pagadas. */
export default function CuentasCobroView({ showToast, onOpenCase }) {
  const [periodo, setPeriodo] = useState(null); // null = todas las cuentas (todos los meses)
  const nombrePeriodo = periodo ? `${MESES[periodo.mes - 1]} ${periodo.anio}` : 'Todas las cuentas';
  const { data: cuentas, loading, error, reload: load } = useResource(() => cuentasService.list(periodo), [periodo?.anio, periodo?.mes]);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [abierta, setAbierta] = useState(null); // clienteId de la cuenta abierta en el modal
  const [busqueda, setBusqueda] = useState('');
  const [estadoPago, setEstadoPago] = useState('Todos');

  const cambiarPeriodo = (nuevo) => {
    setPeriodo(nuevo);
    setAbierta(null);
  };

  const visibles = useMemo(
    () => cuentas.filter((c) => (estadoPago === 'Todos' || estadoDe(c) === estadoPago) && matchesSearch(busqueda, [c.cliente])),
    [cuentas, busqueda, estadoPago],
  );

  const resumen = useMemo(() => {
    const total = cuentas.reduce((a, c) => a + c.total, 0);
    const pagado = cuentas.reduce((a, c) => a + c.totalPagado, 0);
    return { total, pagado, pendiente: total - pagado };
  }, [cuentas]);
  const conteo = (estado) => cuentas.filter((c) => estadoDe(c) === estado).length;

  const cuentaAbierta = cuentas.find((c) => c.clienteId === abierta) ?? null;

  /** Todas las remisiones vigentes (de todos los meses) en un Excel; no depende del mes ni de los filtros de la pantalla */
  const guardarExcel = async () => {
    setExportando(true);
    try {
      if (await cuentasService.exportar()) showToast('success', 'Excel de cuentas guardado');
    } catch (reason) {
      showToast('error', reason.message);
    } finally {
      setExportando(false);
    }
  };

  const confirmar = async (pagadas) => {
    setGuardando(true);
    try {
      await cuentasService.guardarPagos(cuentaAbierta.clienteId, periodo, pagadas);
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
      render: (c) => <span className={styles.clientName}>{c.cliente}</span>,
    },
    { key: 'remisiones', width: 110, header: 'Remisiones', align: 'right', render: (c) => c.remisiones.length },
    { key: 'pendiente', width: 130, header: 'Pendiente', align: 'right', className: styles.moneyCell, render: (c) => formatMoney(c.total - c.totalPagado) },
    { key: 'pagado', width: 130, header: 'Pagado', align: 'right', className: styles.moneyCell, render: (c) => formatMoney(c.totalPagado) },
    { key: 'total', width: 130, header: 'Total', align: 'right', className: styles.moneyCell, render: (c) => formatMoney(c.total) },
    { key: 'pagadas', width: 95, header: 'Pagadas', render: (c) => `${c.pagadas} de ${c.remisiones.length}` },
    { key: 'estado', width: 135, header: 'Estado', render: (c) => <PagoBadge estado={estadoDe(c)} /> },
    {
      key: 'acciones', width: 150,
      header: '',
      headerProps: { 'aria-label': 'Acciones', className: styles.actionsTh },
      render: (c) => (
        <div className={styles.rowActions}>
          <Button size="sm" variant="accent" icon="chevronRight" onClick={(e) => { e.stopPropagation(); setAbierta(c.clienteId); }}>Ver cuenta</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Panel
        title={`Cuentas de estado · ${nombrePeriodo}`}
        meta={contar(visibles.length, 'cliente', 'clientes', loading)}
        actions={(
          <Button icon="download" onClick={guardarExcel} disabled={exportando} title="Descarga un Excel con todas las remisiones vigentes de todos los meses: una hoja por cliente y un resumen">
            {exportando ? 'Generando…' : 'Guardar Excel'}
          </Button>
        )}
      >
        <div className={ds.summaryBar}>
          <div className={styles.kpis}>
            <div className={styles.kpi}><span>Total facturado</span><strong>{loading ? '…' : formatMoney(resumen.total)}</strong></div>
            <div className={styles.kpi}><span>Pagado</span><strong>{loading ? '…' : formatMoney(resumen.pagado)}</strong></div>
            <div className={styles.kpi}><span>Pendiente de cobro</span><strong>{loading ? '…' : formatMoney(resumen.pendiente)}</strong></div>
          </div>
        </div>

        <div className={ds.toolbar}>
          <SearchField className={`${styles.caseSearch} ${ds.toolbarGrow}`} value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente" label="Buscar cliente" />
          <Field label="Mes">
            <MonthFilter periodo={periodo} onChange={cambiarPeriodo} textoTodos="Todas las cuentas" />
          </Field>
          <Field label="Estado de pago">
            <Segmented
              label="Filtrar por estado de pago"
              value={estadoPago}
              onChange={setEstadoPago}
              options={[
                { value: 'Todos', label: 'Todas', count: cuentas.length },
                { value: 'Pendiente', label: 'Pendientes', count: conteo('Pendiente') },
                { value: 'Pago parcial', label: 'Pago parcial', count: conteo('Pago parcial') },
                { value: 'Pagada', label: 'Pagadas', count: conteo('Pagada') },
              ]}
            />
          </Field>
        </div>

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
            ? { title: periodo ? 'No hay remisiones en este mes' : 'Aún no hay remisiones', children: periodo ? 'Cambia el mes o elige «Todas las cuentas».' : 'Aparecerán al crear remisiones.' }
            : { title: 'Ningún cliente coincide', children: 'Cambia la búsqueda o el estado de pago.' }}
        />
      </Panel>

      {cuentaAbierta && (
        <CuentaCobroModal
          key={cuentaAbierta.clienteId}
          cuenta={cuentaAbierta}
          periodo={periodo ? `${MESES[periodo.mes - 1].toLowerCase()} de ${periodo.anio}` : 'todos los meses'}
          saving={guardando}
          onClose={() => setAbierta(null)}
          onConfirm={confirmar}
          onOpenCase={onOpenCase}
          showToast={showToast}
        />
      )}
    </>
  );
}
