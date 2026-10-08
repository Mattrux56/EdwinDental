import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../dashboard.module.css';
import { Icon } from './Icon.jsx';
import { useEscape } from './Modal.jsx';

const MIN = 0.25;
const MAX = 8;
const PASO = 1.25;

/**
 * Foto ampliada sobre toda la pantalla. Se puede acercar/alejar (botones, Ctrl + rueda, teclas + − 0,
 * doble clic), desplazar con barras o arrastrando, y se cierra con Escape, la X o un clic en el fondo.
 */
export default function ImageViewer({ src, onClose }) {
  const stageRef = useRef(null);
  const drag = useRef(null);
  const [natural, setNatural] = useState(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);

  useEscape(onClose);

  // Tamaño disponible para la imagen
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const medir = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  const ajustar = natural && stage.w ? Math.min(stage.w / natural.w, stage.h / natural.h, 1) : 1;
  const escala = ajustar * zoom;

  const cambiar = useCallback((factor) => setZoom((z) => Math.min(MAX, Math.max(MIN, z * factor))), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '+' || e.key === '=') cambiar(PASO);
      else if (e.key === '-') cambiar(1 / PASO);
      else if (e.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cambiar]);

  // Ctrl + rueda (o pellizco del trackpad) para el zoom; la rueda sola desplaza
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      cambiar(e.deltaY < 0 ? PASO : 1 / PASO);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [cambiar]);

  const onPointerDown = (e) => {
    const el = stageRef.current;
    if (e.button !== 0 || !el) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
    el.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    stageRef.current.scrollLeft = d.left - dx;
    stageRef.current.scrollTop = d.top - dy;
  };
  const onPointerUp = () => {
    // Se conserva `moved` hasta el clic que sigue para no cerrar el visor al soltar un arrastre
    setTimeout(() => {
      drag.current = null;
    }, 0);
  };
  const onStageClick = (e) => {
    if (e.target !== e.currentTarget) return;
    if (drag.current?.moved) return;
    onClose();
  };

  const pct = Math.round(escala * 100);

  return (
    <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="Fotografía ampliada">
      <div
        ref={stageRef}
        className={`${styles.lightboxStage} ${zoom > 1 ? styles.lightboxGrab : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onStageClick}
      >
        <img
          className={styles.lightboxImg}
          src={src}
          alt="Fotografía ampliada"
          draggable={false}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
          style={natural ? { width: natural.w * escala, height: natural.h * escala } : { visibility: 'hidden' }}
        />
      </div>

      <div className={styles.lightboxBar}>
        <button type="button" onClick={() => cambiar(1 / PASO)} disabled={zoom <= MIN} aria-label="Alejar" title="Alejar (−)">
          <Icon name="minus" size={18} />
        </button>
        <span className={styles.lightboxPct}>{pct}%</span>
        <button type="button" onClick={() => cambiar(PASO)} disabled={zoom >= MAX} aria-label="Acercar" title="Acercar (+)">
          <Icon name="plus" size={18} />
        </button>
        <button type="button" className={styles.lightboxFit} onClick={() => setZoom(1)} title="Ajustar a la pantalla (0)">
          Ajustar
        </button>
      </div>

      <button type="button" className={styles.lightboxClose} onClick={onClose} aria-label="Cerrar imagen">
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}
