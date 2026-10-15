import { useEffect, useRef, useState } from 'react';
import styles from '../../styles/app.module.css';
import { Icon } from './Icon.jsx';
import Modal from './Modal.jsx';

const mensajeError = (error) => {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'No se dio permiso para usar la cámara.';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return 'No se encontró ninguna cámara.';
  if (error?.name === 'NotReadableError') return 'La cámara está siendo usada por otro programa.';
  return 'No se pudo abrir la cámara.';
};

const CLAVE_CAMARA = 'labtrace.camara';

/** Cámara elegida la última vez: { deviceId, label } o null */
const leerCamara = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CAMARA)) || null;
  } catch {
    return null;
  }
};

const guardarCamara = (camara) => {
  try {
    if (camara) localStorage.setItem(CLAVE_CAMARA, JSON.stringify(camara));
    else localStorage.removeItem(CLAVE_CAMARA);
  } catch {
    // sin almacenamiento: simplemente no se recuerda
  }
};

/** Cámara en vivo: cada captura se entrega con onCapture y la cámara sigue abierta hasta cerrarla */
export default function CameraCapture({ onCapture, onClose, restantes }) {
  const videoRef = useRef(null);
  const [deviceId, setDeviceId] = useState(() => leerCamara()?.deviceId ?? '');
  const [camaras, setCamaras] = useState([]);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  const [tomadas, setTomadas] = useState(0);
  const [flash, setFlash] = useState(0);

  // Abre (o cambia) la cámara y la apaga al cerrar
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este equipo no permite usar la cámara desde la aplicación.');
      return undefined;
    }
    let stream = null;
    let cancelado = false;
    setListo(false);
    const video = { width: { ideal: 1920 }, height: { ideal: 1080 }, ...(deviceId && { deviceId: { exact: deviceId } }) };
    navigator.mediaDevices
      .getUserMedia({ video, audio: false })
      .then(async (s) => {
        if (cancelado) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setError('');
        if (videoRef.current) videoRef.current.srcObject = s;
        // Los nombres de las cámaras solo están disponibles después de dar permiso
        const dispositivos = await navigator.mediaDevices.enumerateDevices();
        if (cancelado) return;
        const lista = dispositivos.filter((d) => d.kind === 'videoinput');
        setCamaras(lista);
        // El id de una cámara puede cambiar; si la guardada no aparece por id, se busca por nombre
        const guardada = leerCamara();
        if (guardada?.label && !lista.some((c) => c.deviceId === deviceId)) {
          const igual = lista.find((c) => c.label === guardada.label);
          if (igual && igual.deviceId !== deviceId && igual.deviceId !== guardada.deviceId) {
            guardarCamara({ deviceId: igual.deviceId, label: igual.label });
            setDeviceId(igual.deviceId);
          }
        }
      })
      .catch((e) => {
        if (cancelado) return;
        // La cámara guardada ya no está conectada: se usa la predeterminada sin olvidar la preferencia
        if (deviceId && (e?.name === 'OverconstrainedError' || e?.name === 'NotFoundError')) setDeviceId('');
        else setError(mensajeError(e));
      });
    return () => {
      cancelado = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId]);

  const elegirCamara = (id) => {
    const camara = camaras.find((c) => c.deviceId === id);
    guardarCamara(id ? { deviceId: id, label: camara?.label ?? '' } : null);
    setDeviceId(id);
  };

  const capturar = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || restantes <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const sello = new Date().toISOString().replace(/[:.]/g, '-');
        onCapture(new File([blob], `foto-${sello}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
        setTomadas((n) => n + 1);
        setFlash((n) => n + 1);
      },
      'image/jpeg',
      0.9,
    );
  };

  return (
    <Modal title="Tomar foto" subtitle="Las fotos se agregan al instante; cierra la cámara cuando termines" onClose={onClose} className={styles.cameraPanel}>
      {error ? (
        <span className={styles.fieldError} role="alert">
          {error}
        </span>
      ) : (
        <div className={styles.cameraStage}>
          <video
            ref={videoRef}
            className={styles.cameraVideo}
            autoPlay
            playsInline
            muted
            onLoadedData={() => setListo(true)}
          />
          {flash > 0 && <div key={flash} className={styles.cameraFlash} />}
        </div>
      )}

      <div className={styles.cameraActions}>
        {camaras.length > 1 && (
          <select value={deviceId} onChange={(event) => elegirCamara(event.target.value)} aria-label="Cámara">
            <option value="">Cámara predeterminada</option>
            {camaras.map((c, i) => (
              <option key={c.deviceId || i} value={c.deviceId}>
                {c.label || `Cámara ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        <button type="button" className={styles.primaryBtn} onClick={capturar} disabled={!listo || Boolean(error) || restantes <= 0}>
          <Icon name="camera" size={16} /> Capturar
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={onClose}>
          Cerrar cámara
        </button>
        <span className={styles.hint}>
          {tomadas > 0 && `${tomadas} foto(s) tomada(s) · `}
          {restantes > 0 ? `Puedes agregar ${restantes} más` : 'Ya se alcanzó el máximo de imágenes'}
        </span>
      </div>
    </Modal>
  );
}
