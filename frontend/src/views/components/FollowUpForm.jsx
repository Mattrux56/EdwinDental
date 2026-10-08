import { useState } from 'react';
import styles from '../dashboard.module.css';
import { MOVIMIENTOS, normalizeEstado } from '../../constants.js';
import PhotoPicker from './PhotoPicker.jsx';
import ImageViewer from './ImageViewer.jsx';
import { ConfirmModal } from './Modal.jsx';
import { Icon } from './Icon.jsx';

const esIngreso = (seg) => seg?.tipo?.toLocaleLowerCase('es') === 'ingreso inicial';

/**
 * Formulario de movimiento. Sin `seguimiento` registra uno nuevo; con `seguimiento` edita ese mismo
 * (se usa dentro de una ventana modal, con `onCancel` para volver a la lista).
 */
export default function FollowUpForm({ caso, saving, onSubmit, seguimiento, onCancel, onDeleteImage }) {
  const editando = Boolean(seguimiento);
  const estadoActual = normalizeEstado(caso.estado);
  const movimientoActual = editando
    ? MOVIMIENTOS.find((m) => m.tipo === seguimiento.tipo?.toLocaleLowerCase('es')) ?? MOVIMIENTOS[0]
    : MOVIMIENTOS.find((m) => m.estado === estadoActual) ?? MOVIMIENTOS[0];
  const [movimiento, setMovimiento] = useState(`${movimientoActual.tipo}|${movimientoActual.estado}`);
  const [descripcion, setDescripcion] = useState(editando ? seguimiento.descripcion : '');
  const [fechaEntregaEstimada, setFechaEntregaEstimada] = useState(
    editando && seguimiento.fechaEntregaEstimada ? String(seguimiento.fechaEntregaEstimada).slice(0, 10) : '',
  );
  const [fotos, setFotos] = useState([]);
  const [verFoto, setVerFoto] = useState(null);
  const [fotoABorrar, setFotoABorrar] = useState(null);
  const idp = editando ? 'fe' : 'fu';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const [tipo, estado] = movimiento.split('|');
    if (editando) {
      await onSubmit(caso.id, seguimiento.id, {
        ...(esIngreso(seguimiento) ? {} : { tipo }),
        fechaEntregaEstimada,
        descripcion,
        fotos,
      });
      return;
    }
    const updated = await onSubmit(caso.id, {
      tipo,
      estado,
      fechaEntregaEstimada: fechaEntregaEstimada || undefined,
      descripcion,
      fotos,
    });
    if (updated) {
      setDescripcion('');
      const estadoNuevo = normalizeEstado(updated.estado);
      const siguiente = MOVIMIENTOS.find((m) => m.estado === estadoNuevo) ?? MOVIMIENTOS[0];
      setMovimiento(`${siguiente.tipo}|${siguiente.estado}`);
      setFechaEntregaEstimada('');
      setFotos([]);
    }
  };

  return (
    <form className={editando ? undefined : styles.followUp} onSubmit={handleSubmit}>
      {!editando && (
        <h3 className={styles.sectionTitle} style={{ marginBottom: 14 }}>
          Registrar movimiento
        </h3>
      )}

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idp}-movimiento`}>
            Movimiento y estado
          </label>
          {editando && esIngreso(seguimiento) ? (
            <select id={`${idp}-movimiento`} className={styles.select} value="ingreso" disabled>
              <option value="ingreso">Ingreso inicial · En laboratorio</option>
            </select>
          ) : (
            <select id={`${idp}-movimiento`} className={styles.select} value={movimiento} onChange={(e) => setMovimiento(e.target.value)}>
              {MOVIMIENTOS.map((m) => (
                <option key={m.tipo} value={`${m.tipo}|${m.estado}`}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${idp}-entrega`}>
            Entrega estimada de este seguimiento
          </label>
          <input
            id={`${idp}-entrega`}
            className={styles.input}
            type="date"
            value={fechaEntregaEstimada}
            onChange={(e) => setFechaEntregaEstimada(e.target.value)}
          />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor={`${idp}-desc`}>
            Descripción <span className={styles.required}>*</span>
          </label>
          <textarea
            id={`${idp}-desc`}
            className={styles.textarea}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
            maxLength={5000}
            placeholder="Describe la prueba, el reingreso, la entrega o el arreglo"
          />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          {editando && (seguimiento.imagenes?.length ?? 0) > 0 && (
            <>
              <span className={styles.label}>Fotografías actuales</span>
              <div className={styles.photoEdit}>
                {seguimiento.imagenes.map((img) => (
                  <div key={img.id} className={styles.photoEditItem}>
                    <button
                      type="button"
                      className={styles.timelineImgBtn}
                      onClick={() => setVerFoto(img.urlImagen)}
                      aria-label="Ampliar fotografía"
                    >
                      <img src={img.urlImagen} alt="Fotografía del seguimiento" loading="lazy" />
                    </button>
                    {onDeleteImage && (
                      <button
                        type="button"
                        className={styles.photoEditDelete}
                        onClick={() => setFotoABorrar(img.id)}
                        disabled={saving}
                        aria-label="Eliminar fotografía"
                        title="Eliminar fotografía"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <span className={styles.label}>{editando ? 'Agregar fotografías' : 'Fotografías'}</span>
          <PhotoPicker files={fotos} onChange={setFotos} />
        </div>
      </div>

      <div className={styles.formActions}>
        {editando && (
          <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={saving}>
            Volver a la lista
          </button>
        )}
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar seguimiento'}
        </button>
      </div>

      {verFoto && <ImageViewer src={verFoto} onClose={() => setVerFoto(null)} />}
      {fotoABorrar && (
        <ConfirmModal
          title="Eliminar fotografía"
          confirmLabel="Eliminar foto"
          busyLabel="Eliminando…"
          busy={saving}
          onCancel={() => setFotoABorrar(null)}
          onConfirm={async () => {
            if (await onDeleteImage(fotoABorrar)) setFotoABorrar(null);
          }}
        >
          <p>La foto se borra del historial y del almacenamiento. No se puede deshacer.</p>
        </ConfirmModal>
      )}
    </form>
  );
}
