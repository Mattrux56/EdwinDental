/** Utilidades para dibujar documentos (nota, remisión) en un canvas */

export const cargarImagen = (url) =>
  new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error('No se pudo cargar la plantilla del documento.'));
    imagen.src = url;
  });

/** Carga las imágenes una sola vez; si falla, se reintenta en la próxima llamada */
export function cacheImagenes(urls) {
  let imagenes = null;
  return () => {
    imagenes ??= Promise.all(urls.map(cargarImagen)).catch((error) => {
      imagenes = null;
      throw error;
    });
    return imagenes;
  };
}

/** Parte el texto en renglones que caben en `ancho` (respeta los saltos de línea y corta palabras muy largas) */
export function renglones(ctx, texto, ancho) {
  const salida = [];
  for (const parrafo of texto.split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      let resto = palabra;
      while (ctx.measureText(resto).width > ancho) {
        let corte = resto.length - 1;
        while (corte > 1 && ctx.measureText(resto.slice(0, corte)).width > ancho) corte--;
        if (actual) salida.push(actual);
        salida.push(resto.slice(0, corte));
        actual = '';
        resto = resto.slice(corte);
      }
      const prueba = actual ? `${actual} ${resto}` : resto;
      if (ctx.measureText(prueba).width <= ancho) {
        actual = prueba;
      } else {
        salida.push(actual);
        actual = resto;
      }
    }
    salida.push(actual);
  }
  return salida;
}
