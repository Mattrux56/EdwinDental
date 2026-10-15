import styles from '../dashboard.module.css';

/**
 * Vista previa de impresión: la hoja con sus márgenes y la imagen ubicada como saldrá impresa.
 * `pagina` es una de las de utils/imprimirImagen.js (PAGINAS), la misma que se usa al imprimir.
 */
export default function HojaPreview({ imagen, pagina, alt, cargando = 'Generando vista previa…' }) {
  const { ancho, alto, arriba, lados, abajo, anchoImagen } = pagina;
  // Los márgenes en % se calculan sobre el ancho de la hoja, así todo escala junto
  const pct = (pulgadas) => `${(pulgadas / ancho) * 100}%`;
  return (
    <div className={styles.hojaMarco}>
      <div
        className={styles.hojaPreview}
        style={{ aspectRatio: `${ancho} / ${alto}`, padding: `${pct(arriba)} ${pct(lados)} ${pct(abajo)}` }}
      >
        {imagen ? (
          <img
            src={imagen}
            alt={alt}
            className={anchoImagen ? styles.hojaImagenReal : styles.hojaImagenAjustada}
            style={anchoImagen ? { width: `${(anchoImagen / (ancho - 2 * lados)) * 100}%` } : undefined}
          />
        ) : (
          <span className={styles.mutedText}>{cargando}</span>
        )}
      </div>
    </div>
  );
}
