import { useMemo, useState } from 'react';
import styles from '../../styles/app.module.css';
import { formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import { remisionesService } from '../../services/remisiones.service.js';
import DataTable from './DataTable.jsx';
import Modal from './Modal.jsx';
import RemisionDetailModal from './RemisionDetailModal.jsx';
import { Badge } from './ui.jsx';

/** Remisiones de un cliente en el mes: se marca cuáles están pagadas y se guarda con «Confirmar remisiones» */
export default function CuentaCobroModal({ cuenta, periodo, saving, onClose, onConfirm, showToast }) {
  const [remisionAbierta, setRemisionAbierta] = useState(null);
  const [cargandoId, setCargandoId] = useState(null);
  const original = useMemo(() => new Set(cuenta.remisiones.filter((x) => x.pagada).map((x) => x.id)), [cuenta]);
  const [pagadas, setPagadas] = useState(() => new Set(original));

  const todas = pagadas.size === cuenta.remisiones.length;
  const cambios = pagadas.size !== original.size || [...pagadas].some((id) => !original.has(id));
  const totalPagado = cuenta.remisiones.filter((x) => pagadas.has(x.id)).reduce((a, x) => a + x.total, 0);

  const alternar = (id, marcada) => {
    setPagadas((actuales) => {
      const siguiente = new Set(actuales);
      if (marcada) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  };

  /** La cuenta solo trae el resumen de cada remisión: el detalle completo se pide al abrirla */
  const verRemision = async (id) => {
    if (cargandoId !== null) return;
    setCargandoId(id);
    try {
      setRemisionAbierta(await remisionesService.get(id));
    } catch (reason) {
      showToast?.('error', reason.message);
    } finally {
      setCargandoId(null);
    }
  };

  const columnas = [
    {
      key: 'marca',
      header: (
        <input
          type="checkbox"
          className={styles.checkPago}
          checked={todas}
          onChange={(e) => setPagadas(e.target.checked ? new Set(cuenta.remisiones.map((x) => x.id)) : new Set())}
          disabled={saving}
          aria-label="Marcar todas las remisiones como pagadas"
          title="Marcar todas"
        />
      ),
      render: (x) => (
        <input
          type="checkbox"
          className={styles.checkPago}
          checked={pagadas.has(x.id)}
          onChange={(e) => alternar(x.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()} // marcar como pagada no abre la remisión
          disabled={saving}
          aria-label={`Remisión ${formatRemisionNumber(x)} pagada`}
        />
      ),
    },
    {
      key: 'pagada',
      header: 'Pagada',
      render: (x) => <Badge tone={pagadas.has(x.id) ? 'done' : 'lab'}>{pagadas.has(x.id) ? 'Pagada' : 'Pendiente'}</Badge>,
    },
    { key: 'remision', header: 'Remisión', render: (x) => (cargandoId === x.id ? 'Abriendo…' : formatRemisionNumber(x)) },
    { key: 'fecha', header: 'Fecha', render: (x) => formatEstimatedDate(x.fecha) },
    { key: 'doctor', header: 'Doctor', render: (x) => x.doctor || '—' },
    { key: 'paciente', header: 'Paciente', render: (x) => x.paciente || '—' },
    { key: 'orden', header: 'Orden de trabajo', render: (x) => x.ordenTrabajo || x.noOrden || '—' },
    { key: 'valor', header: 'Valor', align: 'right', className: styles.moneyCell, render: (x) => formatMoney(x.total) },
  ];

  return (
    <Modal
      title={cuenta.cliente}
      subtitle={`Remisiones de ${periodo}. Marca las que ya están pagadas y confirma.`}
      onClose={onClose}
      busy={saving}
      className={styles.wideModal}
    >
      <DataTable
        variant="mini"
        columns={columnas}
        rows={cuenta.remisiones}
        onRowClick={(x) => verRemision(x.id)}
        rowLabel={(x) => `Ver remisión ${formatRemisionNumber(x)}`}
      />

      <div className={styles.cuentaFooter}>
        <span>
          Pagado <strong>{formatMoney(totalPagado)}</strong> de <strong>{formatMoney(cuenta.total)}</strong>
          {' · '}{pagadas.size} de {cuenta.remisiones.length} {cuenta.remisiones.length === 1 ? 'remisión' : 'remisiones'}
        </span>
        <div className={styles.formActions} style={{ margin: 0 }}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className={styles.primaryBtn} onClick={() => onConfirm([...pagadas])} disabled={saving || !cambios}>
            {saving ? 'Guardando…' : 'Confirmar remisiones'}
          </button>
        </div>
      </div>

      {remisionAbierta && (
        <RemisionDetailModal remision={remisionAbierta} onClose={() => setRemisionAbierta(null)} showToast={showToast} />
      )}
    </Modal>
  );
}
