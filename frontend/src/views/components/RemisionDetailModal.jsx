import styles from '../dashboard.module.css';
import r from '../remisiones.module.css';
import { formatDateTime, formatEstimatedDate, formatMoney } from '../../utils/format.js';
import { Icon } from './Icon.jsx';
import Modal from './Modal.jsx';
import PrintRemisionButton from './PrintRemisionButton.jsx';

/** Detalle de una remisión: encabezado, líneas con cantidades y precios, total. Editar/anular solo si se pasan los callbacks. */
export default function RemisionDetailModal({ remision, onClose, onEdit, onAnular, onReactivar, reactivando, showToast }) {
  const doctor = remision.doctorNombre ?? remision.caso?.cliente?.nombre;
  const paciente = remision.pacienteNombre ?? remision.caso?.pacienteNombre;

  return (
    <Modal
      title={`Remisión N° ${remision.numero}`}
      subtitle={remision.anulada ? 'Anulada: no cuenta en las cuentas de cobro.' : undefined}
      onClose={onClose}
      className={r.wideModal}
    >
      <div className={styles.infoGrid}>
        <div><div className={styles.infoLabel}>Fecha</div><div className={styles.infoValue}>{formatEstimatedDate(remision.fecha)}</div></div>
        <div><div className={styles.infoLabel}>Orden de trabajo</div><div className={styles.infoValue}>{remision.caso?.codigo}</div></div>
        <div><div className={styles.infoLabel}>Número de factura</div><div className={styles.infoValue}>{remision.caso?.numeroFactura || '—'}</div></div>
        <div><div className={styles.infoLabel}>Doctor(a) / clínica</div><div className={styles.infoValue}>{doctor || '—'}</div></div>
        <div><div className={styles.infoLabel}>Paciente</div><div className={styles.infoValue}>{paciente || '—'}</div></div>
        <div><div className={styles.infoLabel}>No. de orden</div><div className={styles.infoValue}>{remision.noOrden || '—'}</div></div>
        <div>
          <div className={styles.infoLabel}>Registro</div>
          <div className={styles.infoValue}>
            {formatDateTime(remision.creadoEn)}
            {remision.editadaEn && <div className={styles.hint}>Corregida el {formatDateTime(remision.editadaEn)}</div>}
          </div>
        </div>
      </div>

      <div className={r.detailTableWrap}>
        <table className={r.miniTable}>
          <thead>
            <tr><th>Cant.</th><th>Descripción</th><th style={{ textAlign: 'right' }}>Valor unitario</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr>
          </thead>
          <tbody>
            {remision.items.map((item) => (
              <tr key={item.id}>
                <td>{item.cantidad}</td>
                <td>{item.descripcion}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(item.valorUnitario)}</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(item.cantidad * item.valorUnitario)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} style={{ textAlign: 'right' }}><strong>Total</strong></td><td style={{ textAlign: 'right' }}><strong>{formatMoney(remision.total)}</strong></td></tr>
          </tfoot>
        </table>
      </div>

      <div className={styles.formActions}>
        {onAnular && !remision.anulada && (
          <button type="button" className={styles.deleteBtn} onClick={() => onAnular(remision)}>Anular</button>
        )}
        {onReactivar && remision.anulada && (
          <button type="button" className={styles.secondaryBtn} onClick={() => onReactivar(remision)} disabled={reactivando}>
            {reactivando ? 'Reactivando…' : 'Quitar anulación'}
          </button>
        )}
        {onEdit && !remision.anulada && (
          <button type="button" className={styles.secondaryBtn} onClick={() => onEdit(remision)}><Icon name="edit" size={15} /> Corregir</button>
        )}
        <PrintRemisionButton remision={remision} showToast={showToast} className={styles.primaryBtn} iconSize={16} busyLabel="Guardando…" />
      </div>
    </Modal>
  );
}
