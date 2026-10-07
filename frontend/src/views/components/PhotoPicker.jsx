import { useEffect, useRef, useState } from 'react';
import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';
import { comprimirImagen } from '../../utils/image.js';

const MAX_FILES = 6;
const MAX_BYTES = 25 * 1024 * 1024; // se comprimen antes de subir; este tope solo evita procesar archivos enormes

/** Adjuntar imágenes desde archivos o la galería del dispositivo */
export default function PhotoPicker({ files, onChange }) {
  const fileInput = useRef(null);
  const [previews, setPreviews] = useState([]);
  const [notice, setNotice] = useState('');
  const [processing, setProcessing] = useState(false);

  // Las URLs temporales se crean y liberan en el mismo efecto (seguro con StrictMode)
  useEffect(() => {
    const items = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPreviews(items);
    return () => items.forEach((item) => URL.revokeObjectURL(item.url));
  }, [files]);

  const handlePick = async (event) => {
    const all = Array.from(event.target.files || []);
    event.target.value = ''; // permite volver a elegir el mismo archivo
    const images = all.filter((f) => f.type.startsWith('image/'));
    const candidatas = images.filter((f) => f.size <= MAX_BYTES);
    setProcessing(true);
    // Las fotos se reducen en el navegador: suben más rápido y no superan el límite del servidor (8 MB)
    const comprimidas = await Promise.all(candidatas.map(comprimirImagen));
    setProcessing(false);
    const picked = comprimidas.filter((f) => f.size <= 8 * 1024 * 1024);
    const merged = [...files, ...picked];

    const avisos = [];
    if (all.length > images.length) avisos.push(`${all.length - images.length} archivo(s) no son imágenes y se omitieron`);
    if (images.length > picked.length) avisos.push(`${images.length - picked.length} imagen(es) son demasiado pesadas y se omitieron`);
    if (merged.length > MAX_FILES) avisos.push(`Solo se admiten ${MAX_FILES} imágenes`);
    setNotice(avisos.join('. '));

    if (picked.length) onChange(merged.slice(0, MAX_FILES));
  };

  const remove = (index) => onChange(files.filter((_, i) => i !== index));

  return (
    <div className={styles.photoPicker}>
      <div className={styles.photoActions}>
        <button type="button" className={styles.secondaryBtn} onClick={() => fileInput.current?.click()} disabled={processing}>
          <Icon name="clip" size={16} /> {processing ? 'Preparando fotos…' : 'Adjuntar foto'}
        </button>
        <span className={styles.hint}>Hasta {MAX_FILES} imágenes · se reducen automáticamente</span>
      </div>

      {notice && (
        <span className={styles.fieldError} role="alert">
          {notice}
        </span>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className={styles.hiddenInput}
        onChange={handlePick}
      />

      {previews.length > 0 && (
        <div className={styles.photoGrid}>
          {previews.map((item, index) => (
            <div key={item.url} className={styles.photoThumb}>
              <img src={item.url} alt={item.name} />
              <button
                type="button"
                className={styles.photoRemove}
                onClick={() => remove(index)}
                aria-label={`Quitar ${item.name}`}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
