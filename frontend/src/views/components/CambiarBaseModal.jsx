import { useEffect, useState } from 'react';
import styles from '../../styles/app.module.css';
import Modal from './Modal.jsx';

const CLAVES = [
  { clave: 'DATABASE_URL', ayuda: 'Conexión de la aplicación (pooler, puerto 6543)' },
  { clave: 'DIRECT_URL', ayuda: 'Conexión directa (puerto 5432)' },
  { clave: 'SUPABASE_URL', ayuda: 'https://[REF].supabase.co' },
  { clave: 'SUPABASE_ANON_KEY', ayuda: 'Clave anon del proyecto (fotos de los casos)' },
];

/** Cambia la base de datos de la app de escritorio: escribe las claves del .env (o importa uno) y reinicia el servidor */
export default function CambiarBaseModal({ onClose }) {
  const escritorio = window.labtraceEscritorio;
  const [valores, setValores] = useState(() => Object.fromEntries(CLAVES.map(({ clave }) => [clave, ''])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    escritorio.configLeer().then((actual) => setValores((v) => ({ ...v, ...actual }))).catch(() => {});
  }, [escritorio]);

  const importar = async () => {
    setError('');
    try {
      const importado = await escritorio.configImportar();
      if (importado) setValores((v) => ({ ...v, ...importado }));
    } catch (e) {
      setError(e.message);
    }
  };

  const guardar = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Si todo sale bien el servidor se reinicia y esta ventana se recarga sola con la base nueva
      const resultado = await escritorio.configGuardar(valores);
      if (resultado?.ok) {
        // Respaldo: la ventana ya se recarga desde el proceso principal; así nunca queda la app con datos de la base anterior
        window.location.reload();
        return;
      }
      setError(resultado?.message ?? 'No se pudo cambiar la base de datos.');
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <Modal
      title="Cambiar base de datos"
      subtitle="Escribe las claves del .env o importa el archivo. Al guardar, LabTrace se reinicia con la base nueva."
      onClose={onClose}
      busy={saving}
    >
      <form onSubmit={guardar}>
        <div className={styles.formGrid}>
          {CLAVES.map(({ clave, ayuda }) => (
            <div key={clave} className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label} htmlFor={`base-${clave}`}>{clave}</label>
              <input
                id={`base-${clave}`}
                className={styles.input}
                value={valores[clave]}
                onChange={(e) => setValores((v) => ({ ...v, [clave]: e.target.value }))}
                placeholder={ayuda}
                spellCheck={false}
                autoComplete="off"
                required
                disabled={saving}
              />
            </div>
          ))}
        </div>
        {saving && <p className={styles.hint} role="status">Cambiando la base de datos… no cierres la app.</p>}
        {error && <p className={styles.fieldError} role="alert">{error}</p>}
        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryBtn} onClick={importar} disabled={saving}>
            Importar .env
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Conectando…' : 'Guardar y reiniciar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
