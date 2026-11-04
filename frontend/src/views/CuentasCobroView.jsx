import { useMemo, useState } from 'react';
import styles from '../styles/app.module.css';
import { useResource } from '../hooks/useResource.js';
import { cuentasService } from '../services/cuentas.service.js';
import { formatMoney } from '../utils/format.js';
import { matchesSearch } from '../utils/search.js';
import CuentaCobroModal from './components/CuentaCobroModal.jsx';
import DataTable from './components/DataTable.jsx';
import { FilterBar, MESES, MonthFilter, SearchField, SelectFilter } from './components/filters.jsx';
import { Icon } from './components/Icon.jsx';
import { Badge, contar, Panel } from './components/ui.jsx';

const ESTADOS_PAGO = ['Todos', 'Pendiente', 'Pago parcial', 'Pagada'];

const estadoDe = (c) => (c.pagada ? 'Pagada' : c.pagadas > 0 ? 'Pago parcial' : 'Pendiente');
const TONO_ESTADO = { Pagada: 'done', 'Pago parcial': 'progress', Pendiente: 'lab' };

/** Cuenta de estado = remisiones (no anuladas) de cada cliente en el mes. Al abrir un cliente se marca cuáles están pagadas. */
export default function CuentasCobroView({ showToast, onOpenCase }) {
  const [periodo, setPeriodo] = useState(null); // null = todas las cuentas (todos los meses)
  const nombrePeriodo = periodo ? `${MESES[periodo.mes - 1]} ${periodo.anio}` : 'Todas las cuentas';
  const { data: cuentas, loading, error, reload: load } = useResource(() => cuentasService.list(periodo), [periodo?.anio, periodo?.mes]);
  const [guardando, setGuardando] = useState(false);
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

  const cuentaAbierta = cuentas.find((c) => c.clienteId === abierta) ?? null;

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
      <Panel
        title={`Cuentas de estado · ${nombrePeriodo}`}
        meta={contar(visibles.length, 'cliente', 'clientes', loading)}
        actions={(
          <button type="button" className={styles.secondaryBtn} onClick={() => showToast('error', 'El formato del Excel aún no está definido')}>
            <Icon name="download" size={15} /> Guardar Excel
          </button>
        )}
      >
        <FilterBar>
          <SearchField value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente" label="Buscar cliente" />
          <MonthFilter periodo={periodo} onChange={cambiarPeriodo} textoTodos="Todas las cuentas" />
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
