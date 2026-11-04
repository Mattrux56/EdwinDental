import styles from '../../styles/app.module.css';
import { formatDateTime, formatEstimatedDate, formatMoney, formatRemisionNumber } from '../../utils/format.js';
import { ActionMenu } from './controls.jsx';
import DataTable from './DataTable.jsx';
import Modal from './Modal.jsx';
import { useRemisionAcciones } from './PrintRemisionButton.jsx';
import { Button } from './ui.jsx';

/** Detalle de una remisión: encabezado, líneas con cantidades y precios, total. Editar/anular solo si se pasan los callbacks. */
const COLUMNAS = [
  { key: 'cantidad', width: 80, header: 'Cant.', align: 'right', render: (item) => item.cantidad },
  {
    key: 'descripcion',
    wrap: true,
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
  { key: 'unitario', width: 150, header: 'Valor unitario', align: 'right', render: (item) => formatMoney(item.valorUnitario) },
  { key: 'subtotal', width: 150, header: 'Subtotal', align: 'right', render: (item) => formatMoney(item.cantidad * item.valorUnitario) },
];

export default function RemisionDetailModal({ remision, onClose, onEdit, onAnular, onEliminar, onReactivar, reactivando, onVerCaso, showToast }) {
  const doctor = remision.doctorNombre ?? remision.caso?.doctorNombre;
  const paciente = remision.pacienteNombre ?? remision.caso?.pacienteNombre;
  const { imprimir, guardar, imprimiendo, guardando } = useRemisionAcciones(remision, showToast);

  // Lo menos frecuente y lo destructivo va en «Más acciones», separado y con color propio
  const mas = [
    { label: guardando ? 'Guardando…' : 'Guardar como Excel', icon: 'download', onClick: guardar, disabled: guardando },
    onReactivar && remision.anulada && { label: reactivando ? 'Reactivando…' : 'Quitar anulación', icon: 'refresh', onClick: () => onReactivar(remision), disabled: reactivando },
    onAnular && !remision.anulada && { label: 'Anular remisión', icon: 'close', tone: 'warn', separator: true, note: 'El número no se reutiliza; se puede reactivar', onClick: () => onAnular(remision) },
    onEliminar && remision.anulada && { label: 'Eliminar definitivamente', icon: 'trash', tone: 'danger', separator: true, note: 'No se puede deshacer', onClick: () => onEliminar(remision) },
  ].filter(Boolean);

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
        <div><div className={styles.infoLabel}>Tipo</div><div className={styles.infoValue}>{remision.tipo === 'ELECTRONICA' ? 'Electrónica (FE-)' : 'Cuenta de cobro'}</div></div>
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
        <ActionMenu label="Más acciones" items={mas} />
        {onVerCaso && remision.caso && (
          <Button icon="layers" onClick={() => onVerCaso(remision.caso)}>Ver caso</Button>
        )}
        {onEdit && !remision.anulada && (
          <Button icon="edit" onClick={() => onEdit(remision)}>Editar remisión</Button>
        )}
        <Button variant="primary" icon="printer" onClick={imprimir} disabled={imprimiendo}>
          {imprimiendo ? 'Preparando…' : 'Imprimir'}
        </Button>
      </div>
    </Modal>
  );
}
