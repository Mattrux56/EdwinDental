import { useEffect, useRef, useState } from 'react';
import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';
import { comprimirImagen } from '../../utils/image.js';
import CameraCapture from './CameraCapture.jsx';

const MAX_FILES = 6;
const MAX_BYTES = 25 * 1024 * 1024; // se comprimen antes de subir; este tope solo evita procesar archivos enormes

/** Adjuntar imágenes desde archivos, la galería del dispositivo o la cámara */
export default function PhotoPicker({ files, onChange }) {
  const fileInput = useRef(null);
  const [previews, setPreviews] = useState([]);
  const [notice, setNotice] = useState('');
  const [processing, setProcessing] = useState(0); // cuántos lotes se están comprimiendo
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  // Lista vigente: varias capturas seguidas se suman entre sí aunque el padre aún no haya vuelto a renderizar
  const actuales = useRef(files);
  actuales.current = files;

  // Las URLs temporales se crean y liberan en el mismo efecto (seguro con StrictMode)
  useEffect(() => {
    const items = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPreviews(items);
    return () => items.forEach((item) => URL.revokeObjectURL(item.url));
  }, [files]);

  const agregar = async (all) => {
    const images = all.filter((f) => f.type.startsWith('image/'));
    const candidatas = images.filter((f) => f.size <= MAX_BYTES);
    setProcessing((n) => n + 1);
    // Las fotos se reducen en el navegador: suben más rápido y no superan el límite del servidor (8 MB)
    const comprimidas = await Promise.all(candidatas.map(comprimirImagen));
    setProcessing((n) => n - 1);
    const picked = comprimidas.filter((f) => f.size <= 8 * 1024 * 1024);
    const merged = [...actuales.current, ...picked];

    const avisos = [];
    if (all.length > images.length) avisos.push(`${all.length - images.length} archivo(s) no son imágenes y se omitieron`);
    if (images.length > picked.length) avisos.push(`${images.length - picked.length} imagen(es) son demasiado pesadas y se omitieron`);
    if (merged.length > MAX_FILES) avisos.push(`Solo se admiten ${MAX_FILES} imágenes`);
    setNotice(avisos.join('. '));

    if (picked.length) {
      actuales.current = merged.slice(0, MAX_FILES);
      onChange(actuales.current);
    }
  };

  const handlePick = (event) => {
    const all = Array.from(event.target.files || []);
    event.target.value = ''; // permite volver a elegir el mismo archivo
    agregar(all);
  };

  const remove = (index) => onChange(files.filter((_, i) => i !== index));

  return (
    <div className={styles.photoPicker}>
      <div className={styles.photoActions}>
        <button type="button" className={styles.secondaryBtn} onClick={() => fileInput.current?.click()} disabled={processing > 0}>
          <Icon name="clip" size={16} /> {processing ? 'Preparando fotos…' : 'Adjuntar foto'}
        </button>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => setCamaraAbierta(true)}
          disabled={files.length >= MAX_FILES}
        >
          <Icon name="camera" size={16} /> Tomar foto
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

      {camaraAbierta && (
        <CameraCapture
          onCapture={(file) => agregar([file])}
          onClose={() => setCamaraAbierta(false)}
          restantes={MAX_FILES - files.length}
        />
      )}

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
