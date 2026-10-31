import styles from '../../styles/app.module.css';
import { formatDateTime, formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import { Icon } from './Icon.jsx';
import DataTable from './DataTable.jsx';
import Modal from './Modal.jsx';
import PrintRemisionButton from './PrintRemisionButton.jsx';

/** Detalle de una remisión: encabezado, líneas con cantidades y precios, total. Editar/anular solo si se pasan los callbacks. */
const COLUMNAS = [
  { key: 'cantidad', header: 'Cant.', render: (item) => item.cantidad },
  {
    key: 'descripcion',
    header: 'Descripción',
    render: (item) => (
      <>
        {item.descripcion}
        {item.cantidadSuperior + item.cantidadInferior > 0 && (
          <div className={styles.hint}>
            {[item.cantidadSuperior > 0 && `${item.cantidadSuperior} superior(es)`, item.cantidadInferior > 0 && `${item.cantidadInferior} inferior(es)`].filter(Boolean).join(' · ')}
          </div>
        )}
      </>
    ),
  },
  { key: 'unitario', header: 'Valor unitario', align: 'right', render: (item) => formatMoney(item.valorUnitario) },
  { key: 'subtotal', header: 'Subtotal', align: 'right', render: (item) => formatMoney(item.cantidad * item.valorUnitario) },
];

export default function RemisionDetailModal({ remision, onClose, onEdit, onAnular, onEliminar, onReactivar, reactivando, onVerCaso, showToast }) {
  const doctor = remision.doctorNombre ?? remision.caso?.doctorNombre;
  const paciente = remision.pacienteNombre ?? remision.caso?.pacienteNombre;

  return (
    <Modal
      title={`Remisión N° ${formatRemisionNumber(remision)}`}
      subtitle={remision.anulada ? 'Anulada: no cuenta en la cuenta de estado.' : undefined}
      onClose={onClose}
      className={styles.wideModal}
    >
      <div className={styles.infoGrid}>
        <div><div className={styles.infoLabel}>Fecha</div><div className={styles.infoValue}>{formatEstimatedDate(remision.fecha)}</div></div>
        <div><div className={styles.infoLabel}>Orden de trabajo</div><div className={styles.infoValue}>{remision.caso?.codigo}</div></div>
        <div><div className={styles.infoLabel}>Tipo</div><div className={styles.infoValue}>{remision.tipo === 'ELECTRONICA' ? 'Electrónica' : 'Cuenta de cobro'}</div></div>
        <div><div className={styles.infoLabel}>Clínica</div><div className={styles.infoValue}>{remision.caso?.cliente?.nombre || '—'}</div></div>
        <div><div className={styles.infoLabel}>Doctor(a)</div><div className={styles.infoValue}>{doctor || '—'}</div></div>
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

      <DataTable
        variant="mini"
        columns={COLUMNAS}
        rows={remision.items}
        footer={(
          <tr><td colSpan={3} style={{ textAlign: 'right' }}><strong>Total</strong></td><td style={{ textAlign: 'right' }}><strong>{formatMoney(remision.total)}</strong></td></tr>
        )}
      />

      <div className={styles.formActions}>
        {onVerCaso && remision.caso && (
          <button type="button" className={styles.secondaryBtn} onClick={() => onVerCaso(remision.caso)}>
            <Icon name="layers" size={15} /> Ver caso
          </button>
        )}
        {onAnular && !remision.anulada && (
          <button type="button" className={styles.deleteBtn} onClick={() => onAnular(remision)}>Anular</button>
        )}
        {onEliminar && remision.anulada && (
          <button type="button" className={styles.deleteBtn} onClick={() => onEliminar(remision)}><Icon name="trash" size={15} /> Eliminar</button>
        )}
        {onReactivar && remision.anulada && (
          <button type="button" className={styles.secondaryBtn} onClick={() => onReactivar(remision)} disabled={reactivando}>
            {reactivando ? 'Reactivando…' : 'Quitar anulación'}
          </button>
        )}
        {onEdit && !remision.anulada && (
          <button type="button" className={styles.secondaryBtn} onClick={() => onEdit(remision)}><Icon name="edit" size={15} /> Corregir</button>
        )}
        <PrintRemisionButton remision={remision} showToast={showToast} className={styles.primaryBtn} saveClassName={styles.secondaryBtn} iconSize={16} busyLabel="Guardando…" />
      </div>
    </Modal>
  );
}
