import { useMemo, useState } from 'react';
import styles from '../../styles/app.module.css';
import ds from '../../styles/ds.module.css';
import { formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import { matchesSearch } from '../../utils/search.js';
import DataTable from './DataTable.jsx';
import { ActionMenu, ariaSort, Field, Segmented, SortHeader } from './controls.jsx';
import { MonthFilter, SearchField } from './filters.jsx';
import { useRemisionAcciones } from './PrintRemisionButton.jsx';
import { Button, contar, Panel } from './ui.jsx';

const TIPOS = { NORMAL: 'Cuentas de cobro', ELECTRONICA: 'Electrónicas' };

/** Acciones de una fila: Imprimir a la vista y el resto en «Más acciones» */
function AccionesRemision({ remision, onView, showToast }) {
  const { imprimir, guardar, imprimiendo, guardando } = useRemisionAcciones(remision, showToast);
  return (
    <div className={styles.rowActions}>
      <Button size="sm" variant="accent" icon="printer" onClick={imprimir} disabled={imprimiendo}>
        {imprimiendo ? 'Preparando…' : 'Imprimir'}
      </Button>
      <ActionMenu
        ariaLabel={`Más acciones de la remisión ${formatRemisionNumber(remision)}`}
        items={[
          { label: 'Ver detalle', icon: 'search', onClick: () => onView(remision) },
          { label: guardando ? 'Guardando…' : 'Guardar como Excel', icon: 'download', onClick: guardar, disabled: guardando },
        ]}
      />
    </div>
  );
}

export default function RemisionesTable({ remisiones, loading, error, onRetry, onView, showToast, actions }) {
  const [query, setQuery] = useState('');
  const [periodo, setPeriodo] = useState(null); // null = todas las remisiones
  // Las dos series no se mezclan: se ve una a la vez y se cambia con un clic en el encabezado «N°»
  const [tipo, setTipo] = useState('NORMAL');
  const [recientesPrimero, setRecientesPrimero] = useState(true);
  // Las anuladas se ven aparte, con el botón «Anuladas» del encabezado
  const [verAnuladas, setVerAnuladas] = useState(false);

  const { filtered, totalAnuladas, totalVigentes } = useMemo(() => {
    const coincide = (rem) => {
      if ((rem.tipo === 'ELECTRONICA' ? 'ELECTRONICA' : 'NORMAL') !== tipo) return false;
      const fecha = String(rem.fecha).slice(0, 10);
      if (periodo && !fecha.startsWith(`${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`)) return false;
      return matchesSearch(query, [formatRemisionNumber(rem), rem.noOrden, rem.caso?.codigo, rem.caso?.cliente?.nombre, rem.pacienteNombre, rem.caso?.pacienteNombre, rem.doctorNombre, rem.caso?.doctorNombre]);
    };
    const coincidentes = remisiones.filter(coincide);
    const lista = coincidentes.filter((rem) => Boolean(rem.anulada) === verAnuladas);
    const sentido = recientesPrimero ? -1 : 1;
    lista.sort((a, b) => sentido * (String(a.fecha).localeCompare(String(b.fecha)) || a.numero - b.numero));
    return { filtered: lista, totalAnuladas: coincidentes.filter((rem) => rem.anulada).length, totalVigentes: coincidentes.filter((rem) => !rem.anulada).length };
  }, [remisiones, query, periodo, tipo, recientesPrimero, verAnuladas]);

  // Cuántas remisiones tiene cada serie con los demás filtros aplicados
  const porTipo = useMemo(() => {
    const cuenta = { NORMAL: 0, ELECTRONICA: 0 };
    remisiones.forEach((rem) => {
      if (Boolean(rem.anulada) !== verAnuladas) return;
      if (periodo && !String(rem.fecha).slice(0, 7).startsWith(`${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`)) return;
      if (!matchesSearch(query, [formatRemisionNumber(rem), rem.noOrden, rem.caso?.codigo, rem.caso?.cliente?.nombre, rem.pacienteNombre, rem.caso?.pacienteNombre, rem.doctorNombre, rem.caso?.doctorNombre])) return;
      cuenta[rem.tipo === 'ELECTRONICA' ? 'ELECTRONICA' : 'NORMAL'] += 1;
    });
    return cuenta;
  }, [remisiones, query, periodo, verAnuladas]);

  const otroTipo = tipo === 'NORMAL' ? 'ELECTRONICA' : 'NORMAL';
  const contador = verAnuladas ? contar(filtered.length, 'anulada', 'anuladas', loading) : contar(filtered.length, 'remisión', 'remisiones', loading);

  const columnas = [
    {
      key: 'numero', width: 120,
      className: styles.numberCell,
      header: 'N°',
      render: (rem) => (
        <>
          {formatRemisionNumber(rem)}
          {rem.anulada && <span className={styles.cancelledBadge}>Anulada</span>}
        </>
      ),
    },
    {
      key: 'fecha', width: 130,
      className: styles.mutedText,
      headerProps: { 'aria-sort': ariaSort(recientesPrimero ? 'desc' : 'asc') },
      header: (
        <SortHeader
          direccion={recientesPrimero ? 'desc' : 'asc'}
          onClick={() => setRecientesPrimero((valor) => !valor)}
          title={recientesPrimero ? 'Más recientes primero. Clic para ordenar de la más antigua' : 'Más antiguas primero. Clic para ordenar de la más reciente'}
        >
          Fecha
        </SortHeader>
      ),
      render: (rem) => formatEstimatedDate(rem.fecha),
    },
    {
      key: 'caso', width: 140,
      header: 'Caso',
      render: (rem) => (
        <>
          <div className={styles.codeCell}>{rem.caso?.codigo}</div>
          <div className={styles.clientDoc}>Orden de trabajo</div>
        </>
      ),
    },
    {
      key: 'cliente',
      header: 'Cliente / Paciente',
      render: (rem) => (
        <>
          <div className={styles.clientName}>{rem.caso?.cliente?.nombre}</div>
          <div className={styles.clientDoc}>{rem.caso?.pacienteNombre || '—'}</div>
        </>
      ),
    },
    { key: 'productos', width: 115, header: 'Productos', align: 'right', className: styles.mutedText, render: (rem) => rem.items.length },
    { key: 'total', width: 140, header: 'Total', align: 'right', className: styles.moneyCell, render: (rem) => formatMoney(rem.total) },
    {
      key: 'acciones', width: 210,
      headerProps: { className: styles.actionsTh, 'aria-label': 'Acciones' },
      header: '',
      render: (rem) => <AccionesRemision remision={rem} onView={onView} showToast={showToast} />,
    },
  ];

  const vacia = remisiones.length === 0
    ? { title: 'Aún no hay remisiones', children: 'Usa “Nueva remisión” para crear la primera.' }
    : verAnuladas
      ? {
          title: 'No hay remisiones anuladas para esta búsqueda',
          children: (
            <>
              Estás viendo {TIPOS[tipo].toLowerCase()} anuladas. Cambia la búsqueda o el periodo, o{' '}
              <button type="button" className={styles.linkBtn} onClick={() => setVerAnuladas(false)}>vuelve a las vigentes</button>.
            </>
          ),
        }
      : {
          title: 'No hay remisiones para esta búsqueda',
          children: (
            <>
              Estás viendo {TIPOS[tipo].toLowerCase()}. Cambia la búsqueda, el periodo o{' '}
              <button type="button" className={styles.linkBtn} onClick={() => setTipo(otroTipo)}>ver {TIPOS[otroTipo].toLowerCase()}</button>
              {totalAnuladas > 0 && (
                <>
                  {' '}o{' '}
                  <button type="button" className={styles.linkBtn} onClick={() => setVerAnuladas(true)}>ver las anuladas ({totalAnuladas})</button>
                </>
              )}.
            </>
          ),
        };

  return (
    <Panel title={verAnuladas ? 'Remisiones anuladas' : 'Remisiones emitidas'} actions={actions} meta={contador}>
      <div className={ds.toolbar}>
        <SearchField className={`${styles.caseSearch} ${ds.toolbarGrow}`} value={query} onChange={setQuery} placeholder="Buscar por número, caso, cliente o paciente" label="Buscar remisiones" />
        <Field label="Mes">
          <MonthFilter periodo={periodo} onChange={setPeriodo} textoTodos="Todas las remisiones" />
        </Field>
        <Field label="Tipo de remisión">
          <Segmented
            label="Tipo de remisión"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'NORMAL', label: TIPOS.NORMAL, count: porTipo.NORMAL },
              { value: 'ELECTRONICA', label: TIPOS.ELECTRONICA, count: porTipo.ELECTRONICA },
            ]}
          />
        </Field>
        <Field label="Estado">
          <Segmented
            label="Remisiones vigentes o anuladas"
            value={verAnuladas ? 'anuladas' : 'vigentes'}
            onChange={(v) => setVerAnuladas(v === 'anuladas')}
            options={[
              { value: 'vigentes', label: 'Vigentes', count: totalVigentes },
              { value: 'anuladas', label: 'Anuladas', count: totalAnuladas },
            ]}
          />
        </Field>
      </div>

      <DataTable
        columns={columnas}
        rows={filtered}
        onRowClick={onView}
        rowLabel={(rem) => `Ver remisión ${formatRemisionNumber(rem)}`}
        rowClassName={(rem) => (rem.anulada ? styles.cancelledRow : '')}
        loading={loading}
        loadingText="Cargando remisiones…"
        error={error && (
          <>
            {error}
            {/relation|table|does not exist|Prisma/i.test(error) && ' (¿ya ejecutaste el SQL de la base de datos?)'}
          </>
        )}
        onRetry={onRetry}
        empty={vacia}
      />
    </Panel>
  );
}
