import { useState } from 'react';
import styles from '../dashboard.module.css';
import PhotoPicker from './PhotoPicker.jsx';

const INITIAL = { clienteNombre: '', documentoIdentidad: '', titulo: '', descripcion: '' };

export default function NewCaseForm({ saving, onSubmit, onCancel }) {
  const [form, setForm] = useState(INITIAL);
  const [fotos, setFotos] = useState([]);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const created = await onSubmit({ ...form, fotos });
    if (created) {
      setForm(INITIAL);
      setFotos([]);
    }
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Registrar caso</h1>
          <p className={styles.pageSubtitle}>
            Se asignará un código automático y se creará el primer movimiento del historial.
          </p>
        </div>
      </div>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="clienteNombre">
              Nombre del cliente <span className={styles.required}>*</span>
            </label>
            <input
              id="clienteNombre"
              className={styles.input}
              value={form.clienteNombre}
              onChange={update('clienteNombre')}
              required
              maxLength={150}
              autoComplete="off"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="documentoIdentidad">
              Documento de identidad
            </label>
            <input
              id="documentoIdentidad"
              className={styles.input}
              value={form.documentoIdentidad}
              onChange={update('documentoIdentidad')}
              maxLength={50}
              autoComplete="off"
            />
            <span className={styles.hint}>Si el documento ya existe, el caso se asocia a ese cliente.</span>
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="titulo">
              Título del caso <span className={styles.required}>*</span>
            </label>
            <input
              id="titulo"
              className={styles.input}
              value={form.titulo}
              onChange={update('titulo')}
              required
              maxLength={200}
              placeholder="Ej.: Prótesis parcial superior — ajuste de oclusión"
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="descripcion">
              Descripción del ingreso <span className={styles.required}>*</span>
            </label>
            <textarea
              id="descripcion"
              className={styles.textarea}
              value={form.descripcion}
              onChange={update('descripcion')}
              required
              maxLength={5000}
              placeholder="Estado en que llega la muestra o pieza, observaciones y trabajo solicitado"
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.label}>Fotografías del ingreso</span>
            <PhotoPicker files={fotos} onChange={setFotos} />
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar caso'}
          </button>
        </div>
      </form>
    </>
  );
}
