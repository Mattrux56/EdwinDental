import { useState } from 'react';
import styles from '../dashboard.module.css';
import { formatDateTime, formatEstimatedDate } from '../../utils/format.js';
import Modal from './Modal.jsx';
import FollowUpForm from './FollowUpForm.jsx';

/** Editar el historial: primero se elige cuál seguimiento y luego se abre el mismo formulario de registro para modificarlo */
export default function EditHistorialModal({ caso, saving, onClose, onSave, onDeleteImage }) {
  const [elegido, setElegido] = useState(null);
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
  return (
    <Modal title="Editar historial de trazabilidad" subtitle="Elige el seguimiento que quieres editar." onClose={onClose}>
      <ul className={styles.editList}>
        {lista.map((seg) => (
          <li key={seg.id}>
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
          </li>
        ))}
      </ul>
    </Modal>
  );
}
