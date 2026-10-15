import { useEffect, useState } from 'react';
import styles from '../dashboard.module.css';
import { generarNota, guardarNota, imprimirNota } from '../../utils/printNota.js';
import { PAGINAS } from '../../utils/imprimirImagen.js';
import HojaPreview from './HojaPreview.jsx';
import { Icon } from './Icon.jsx';
import Modal from './Modal.jsx';

/**
 * Nota de un seguimiento (solo lectura): la plantilla del laboratorio llena con paciente, fecha, doctor,
 * clínica y la descripción del seguimiento en «Observaciones». Solo se puede guardar o imprimir.
 */
export default function NotaModal({ caso, seguimiento, onClose, showToast }) {
  const [imagen, setImagen] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    generarNota({
      doctor: caso.doctorNombre || '',
      clinica: caso.cliente?.nombre || '',
      paciente: caso.pacienteNombre || '',
      fecha: seguimiento.creadoEn,
      observacion: seguimiento.descripcion || '',
    })
      .then((url) => active && setImagen(url))
      .catch((reason) => showToast?.('error', reason.message));
    return () => {
      active = false;
    };
  }, [caso, seguimiento, showToast]);

  const imprimir = async () => {
    try {
      await imprimirNota(imagen);
    } catch (reason) {
      showToast?.('error', reason.message);
    }
  };

  const guardar = async () => {
    setBusy(true);
    try {
      const d = new Date(seguimiento.creadoEn);
      const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await guardarNota(imagen, `NOTA_${caso.codigo}_${dia}.jpg`);
    } catch (reason) {
      showToast?.('error', reason.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Nota" subtitle={seguimiento.tipo} onClose={onClose} busy={busy}>
      <HojaPreview imagen={imagen} pagina={PAGINAS.nota} alt="Nota del seguimiento" cargando="Generando nota…" />

      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryBtn} onClick={guardar} disabled={busy || !imagen}>
          <Icon name="download" size={16} /> {busy ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className={styles.primaryBtn} onClick={imprimir} disabled={busy || !imagen}>
          <Icon name="printer" size={16} /> Imprimir
        </button>
      </div>
    </Modal>
  );
}
