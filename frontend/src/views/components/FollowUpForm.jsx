import { useState } from 'react';
import styles from '../dashboard.module.css';
import { ESTADOS, TIPOS_SEGUIMIENTO } from '../../constants.js';
import PhotoPicker from './PhotoPicker.jsx';

const KEEP = ''; // valor del selector que significa "no cambiar el estado"

export default function FollowUpForm({ caso, saving, onSubmit }) {
  const [tipo, setTipo] = useState(TIPOS_SEGUIMIENTO[0]);
  const [estado, setEstado] = useState(KEEP);
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const updated = await onSubmit(caso.id, { tipo, estado: estado || undefined, descripcion, fotos });
    if (updated) {
      setDescripcion('');
      setEstado(KEEP);
      setFotos([]);
    }
  };

  return (
    <form className={styles.followUp} onSubmit={handleSubmit}>
      <h3 className={styles.sectionTitle} style={{ marginBottom: 14 }}>
        Registrar reingreso o nuevo seguimiento
      </h3>

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="fu-tipo">
            Tipo de movimiento
          </label>
          <select id="fu-tipo" className={styles.select} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_SEGUIMIENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="fu-estado">
            Estado del caso
          </label>
          <select id="fu-estado" className={styles.select} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value={KEEP}>Mantener ({caso.estado})</option>
            {ESTADOS.filter((s) => s !== caso.estado).map((s) => (
              <option key={s} value={s}>
                Cambiar a {s}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="fu-desc">
            Descripción <span className={styles.required}>*</span>
          </label>
          <textarea
            id="fu-desc"
            className={styles.textarea}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required
            maxLength={5000}
            placeholder="Qué se encontró, qué se hizo o por qué vuelve al laboratorio"
          />
        </div>

        <div className={`${styles.field} ${styles.fieldFull}`}>
          <span className={styles.label}>Fotografías</span>
          <PhotoPicker files={fotos} onChange={setFotos} />
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar seguimiento'}
        </button>
      </div>
    </form>
  );
}
