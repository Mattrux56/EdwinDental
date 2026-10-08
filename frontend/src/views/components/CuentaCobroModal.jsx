import { useMemo, useState } from 'react';
import styles from '../dashboard.module.css';
import r from '../remisiones.module.css';
import { formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import Modal from './Modal.jsx';

/** Remisiones de un cliente en el mes: se marca cuáles están pagadas y se guarda con «Confirmar remisiones» */
export default function CuentaCobroModal({ cuenta, periodo, saving, onClose, onConfirm }) {
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

  return (
    <Modal
      title={cuenta.cliente}
      subtitle={`Remisiones de ${periodo}. Marca las que ya están pagadas y confirma.`}
      onClose={onClose}
      busy={saving}
      className={r.wideModal}
    >
      <div className={r.detailTableWrap}>
        <table className={r.miniTable}>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  className={r.checkPago}
                  checked={todas}
                  onChange={(e) => setPagadas(e.target.checked ? new Set(cuenta.remisiones.map((x) => x.id)) : new Set())}
                  disabled={saving}
                  aria-label="Marcar todas las remisiones como pagadas"
                  title="Marcar todas"
                />
              </th>
              <th>Pagada</th>
              <th>Remisión</th>
              <th>Fecha</th>
              <th>Doctor</th>
              <th>Paciente</th>
              <th>Orden de trabajo</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {cuenta.remisiones.map((x) => (
              <tr key={x.id}>
                <td>
                  <input
                    type="checkbox"
                    className={r.checkPago}
                    checked={pagadas.has(x.id)}
                    onChange={(e) => alternar(x.id, e.target.checked)}
                    disabled={saving}
                    aria-label={`Remisión ${formatRemisionNumber(x)} pagada`}
                  />
                </td>
                <td>
                  <span className={`${styles.badge} ${pagadas.has(x.id) ? styles.badgeDone : styles.badgeLab}`}>
                    {pagadas.has(x.id) ? 'Pagada' : 'Pendiente'}
                  </span>
                </td>
                <td>{formatRemisionNumber(x)}</td>
                <td>{formatEstimatedDate(x.fecha)}</td>
                <td>{x.doctor || '—'}</td>
                <td>{x.paciente || '—'}</td>
                <td>{x.ordenTrabajo || x.noOrden || '—'}</td>
                <td className={r.moneyCell}>{formatMoney(x.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={r.cuentaFooter}>
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
    </Modal>
  );
}
