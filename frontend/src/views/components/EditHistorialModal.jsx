import { useState } from 'react';
import styles from '../dashboard.module.css';
import { formatDateTime, formatEstimatedDate } from '../../utils/format.js';
import Modal, { ConfirmModal } from './Modal.jsx';
import FollowUpForm from './FollowUpForm.jsx';
import { Icon } from './Icon.jsx';

const esIngreso = (seg) => seg?.tipo?.toLocaleLowerCase('es') === 'ingreso inicial';

/**
 * Editar el historial: primero se elige cuál seguimiento y luego se abre el mismo formulario de registro para modificarlo.
 * Desde la lista también se puede eliminar un seguimiento (el ingreso inicial solo si es el único).
 */
export default function EditHistorialModal({ caso, saving, onClose, onSave, onDelete, onDeleteImage }) {
  const [elegido, setElegido] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  // Se busca en el caso actual para que, tras guardar, el formulario muestre los datos al día
  const seguimiento = elegido ? caso.seguimientos?.find((s) => s.id === elegido) : null;

  const guardar = async (casoId, seguimientoId, payload) => {
    const ok = await onSave(casoId, seguimientoId, payload);
    if (ok) setElegido(null);
    return ok;
  };

  if (seguimiento) {
    return (
      <Modal
        title={`Editar seguimiento · ${seguimiento.tipo}`}
        subtitle={`Registrado el ${formatDateTime(seguimiento.creadoEn)}`}
        onClose={onClose}
        busy={saving}
      >
        <FollowUpForm
          key={seguimiento.id}
          caso={caso}
          seguimiento={seguimiento}
          saving={saving}
          onSubmit={guardar}
          onCancel={() => setElegido(null)}
          onDeleteImage={onDeleteImage}
        />
      </Modal>
    );
  }

  const lista = caso.seguimientos ?? [];
  const sePuedeBorrar = (seg) => Boolean(onDelete) && (!esIngreso(seg) || lista.length === 1);
  return (
    <Modal
      title="Editar historial de trazabilidad"
      subtitle={onDelete ? 'Elige el seguimiento que quieres editar o eliminar.' : 'Elige el seguimiento que quieres editar.'}
      onClose={onClose}
      busy={saving}
    >
      <ul className={styles.editList}>
        {lista.map((seg) => (
          <li key={seg.id} className={styles.editListRow}>
            <button type="button" className={styles.editListItem} onClick={() => setElegido(seg.id)}>
              <span className={styles.editListHead}>
                <strong>{seg.tipo}</strong>
                <span className={styles.mutedText}>{formatDateTime(seg.creadoEn)}</span>
                {seg.fechaEntregaEstimada && (
                  <span className={styles.mutedText}>Entrega: {formatEstimatedDate(seg.fechaEntregaEstimada)}</span>
                )}
              </span>
              <span className={styles.editListText}>{seg.descripcion}</span>
            </button>
            {sePuedeBorrar(seg) && (
              <button
                type="button"
                className={styles.editListDelete}
                onClick={() => setABorrar(seg)}
                disabled={saving}
                aria-label={`Eliminar seguimiento ${seg.tipo}`}
                title="Eliminar seguimiento"
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {aBorrar && (
        <ConfirmModal
          title="Eliminar seguimiento"
          confirmLabel="Eliminar seguimiento"
          busyLabel="Eliminando…"
          busy={saving}
          onCancel={() => setABorrar(null)}
          onConfirm={async () => {
            if (await onDelete(caso.id, aBorrar.id)) setABorrar(null);
          }}
        >
          <p>
            ¿Eliminar el seguimiento <strong>{aBorrar.tipo}</strong> del {formatDateTime(aBorrar.creadoEn)}? Se borran también
            sus fotos y el estado del caso pasa a ser el del seguimiento anterior. Esta acción no se puede deshacer.
          </p>
        </ConfirmModal>
      )}
    </Modal>
  );
}
