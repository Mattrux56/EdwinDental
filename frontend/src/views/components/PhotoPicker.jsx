import { useEffect, useRef, useState } from 'react';
import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';

const MAX_FILES = 6;

/** Adjuntar desde galería/archivos o capturar con la cámara del dispositivo */
export default function PhotoPicker({ files, onChange }) {
  const fileInput = useRef(null);
  const cameraInput = useRef(null);
  const [previews, setPreviews] = useState([]);

  // Las URLs temporales se crean y liberan en el mismo efecto (seguro con StrictMode)
  useEffect(() => {
    const items = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPreviews(items);
    return () => items.forEach((item) => URL.revokeObjectURL(item.url));
  }, [files]);

  const handlePick = (event) => {
    const picked = Array.from(event.target.files || []).filter((f) => f.type.startsWith('image/'));
    event.target.value = ''; // permite volver a elegir el mismo archivo
    if (picked.length) onChange([...files, ...picked].slice(0, MAX_FILES));
  };

  const remove = (index) => onChange(files.filter((_, i) => i !== index));

  return (
    <div className={styles.photoPicker}>
      <div className={styles.photoActions}>
        <button type="button" className={styles.secondaryBtn} onClick={() => fileInput.current?.click()}>
          <Icon name="clip" size={16} /> Adjuntar foto
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={() => cameraInput.current?.click()}>
          <Icon name="camera" size={16} /> Tomar foto
        </button>
        <span className={styles.hint}>Hasta {MAX_FILES} imágenes · máx. 8 MB cada una</span>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className={styles.hiddenInput}
        onChange={handlePick}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
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
