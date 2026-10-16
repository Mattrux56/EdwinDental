import { useMemo, useState } from 'react';
import styles from '../../styles/app.module.css';
import { formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import { matchesSearch } from '../../utils/search.js';
import DataTable from './DataTable.jsx';
import { FilterBar, PeriodFilter, SearchField } from './filters.jsx';
import PrintRemisionButton from './PrintRemisionButton.jsx';
import { contar, Panel } from './ui.jsx';

const TIPOS = { NORMAL: 'Cuentas de cobro', ELECTRONICA: 'Electrónicas' };

export default function RemisionesTable({ remisiones, loading, error, onRetry, onView, showToast, actions }) {
  const [query, setQuery] = useState('');
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }); // mes 0 = todo el año
  const { anio, mes } = periodo;
  // Las dos series no se mezclan: se ve una a la vez y se cambia con un clic en el encabezado «N°»
  const [tipo, setTipo] = useState('NORMAL');
  const [recientesPrimero, setRecientesPrimero] = useState(true);
  // Las anuladas se ven aparte, con el botón «Anuladas» del encabezado
  const [verAnuladas, setVerAnuladas] = useState(false);

  const { filtered, totalAnuladas } = useMemo(() => {
    const coincide = (rem) => {
      if ((rem.tipo === 'ELECTRONICA' ? 'ELECTRONICA' : 'NORMAL') !== tipo) return false;
      const fecha = String(rem.fecha).slice(0, 10);
      if (!fecha.startsWith(`${anio}-${mes ? String(mes).padStart(2, '0') : ''}`)) return false;
      return matchesSearch(query, [formatRemisionNumber(rem), rem.noOrden, rem.caso?.codigo, rem.caso?.cliente?.nombre, rem.caso?.pacienteNombre]);
    };
    const coincidentes = remisiones.filter(coincide);
    const lista = coincidentes.filter((rem) => Boolean(rem.anulada) === verAnuladas);
    const sentido = recientesPrimero ? -1 : 1;
    lista.sort((a, b) => sentido * (String(a.fecha).localeCompare(String(b.fecha)) || a.numero - b.numero));
    return { filtered: lista, totalAnuladas: coincidentes.filter((rem) => rem.anulada).length };
  }, [remisiones, query, mes, anio, tipo, recientesPrimero, verAnuladas]);

  const otroTipo = tipo === 'NORMAL' ? 'ELECTRONICA' : 'NORMAL';
  const contador = verAnuladas ? contar(filtered.length, 'anulada', 'anuladas', loading) : contar(filtered.length, 'remisión', 'remisiones', loading);

  const columnas = [
    {
      key: 'numero',
      className: styles.numberCell,
      header: (
        <button
          type="button"
          className={styles.thBtn}
          onClick={() => setTipo(otroTipo)}
          title={`Viendo ${TIPOS[tipo].toLowerCase()}. Clic para ver ${TIPOS[otroTipo].toLowerCase()}`}
        >
          N° · {TIPOS[tipo]} <span aria-hidden="true">⇄</span>
        </button>
      ),
      render: (rem) => (
        <>
          {formatRemisionNumber(rem)}
          {rem.anulada && <span className={styles.cancelledBadge}>Anulada</span>}
        </>
      ),
    },
    {
      key: 'fecha',
      className: styles.mutedText,
      headerProps: { 'aria-sort': recientesPrimero ? 'descending' : 'ascending' },
      header: (
        <button
          type="button"
          className={styles.thBtn}
          onClick={() => setRecientesPrimero((valor) => !valor)}
          title={recientesPrimero ? 'Más recientes primero. Clic para ver primero las más antiguas' : 'Más antiguas primero. Clic para ver primero las más recientes'}
        >
          Fecha <span aria-hidden="true">{recientesPrimero ? '▼' : '▲'}</span>
        </button>
      ),
      render: (rem) => formatEstimatedDate(rem.fecha),
    },
    {
      key: 'caso',
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
    { key: 'productos', header: 'Productos', className: styles.mutedText, render: (rem) => rem.items.length },
    { key: 'total', header: 'Total', align: 'right', className: styles.moneyCell, render: (rem) => formatMoney(rem.total) },
    {
      key: 'acciones',
      headerProps: { className: styles.actionsTh },
      header: (
        <button
          type="button"
          className={styles.thBtn}
          onClick={() => setVerAnuladas((valor) => !valor)}
          aria-pressed={verAnuladas}
          title={verAnuladas ? 'Volver a las remisiones vigentes' : 'Ver las remisiones anuladas'}
        >
          {verAnuladas ? '← Vigentes' : `Anuladas (${totalAnuladas})`}
        </button>
      ),
      render: (rem) => (
        <div className={styles.rowActions}>
          <PrintRemisionButton remision={rem} showToast={showToast} className={styles.traceBtn} />
        </div>
      ),
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
      <FilterBar>
        <SearchField value={query} onChange={setQuery} placeholder="Buscar por número, caso, cliente o paciente" label="Buscar remisiones" />
        <PeriodFilter anio={anio} mes={mes} onChange={(a, m) => setPeriodo({ anio: a, mes: m })} todoElAnio flechas />
      </FilterBar>

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
