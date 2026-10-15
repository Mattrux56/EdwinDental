/**
 * Tamaños de hoja para imprimir un documento ya generado como imagen.
 * Las medidas se usan también en la vista previa, así lo que se ve es lo que sale.
 */
// Hoja carta vertical con el documento arriba y centrada, como la plantilla de Excel de la remisión
// (márgenes 0, superior 0.354 in) y a tamaño real (100 %): `anchoImagen` en pulgadas
const CARTA = { ancho: 8.5, alto: 11, arriba: 0.354, lados: 0.25, abajo: 0, anchoImagen: 733 / 96 };

// La nota sale con las mismas medidas que la remisión: las dos se imprimen en papel carta
export const PAGINAS = { remision: CARTA, nota: CARTA };

/**
 * Página HTML de una sola hoja con la imagen. Los márgenes van como relleno del body (con @page sin margen)
 * para que el PDF de la app de escritorio y la impresión del navegador queden iguales.
 */
function documento(imagenUrl, titulo, { ancho, alto, arriba, lados, abajo, anchoImagen }) {
  const tamano = anchoImagen
    ? `width: ${anchoImagen}in; max-width: 100%; height: auto; margin: 0 auto;`
    : 'width: 100%; height: 100%; object-fit: contain; object-position: top center;';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>${titulo.replace(/[<&]/g, '')}</title>
<style>
  @page { size: letter portrait; margin: 0; }
  html, body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { box-sizing: border-box; width: ${ancho}in; height: ${alto}in; padding: ${arriba}in ${lados}in ${abajo}in; overflow: hidden; }
  img { display: block; ${tamano} }
</style></head><body><img src="${imagenUrl}" alt="" /></body></html>`;
}

/**
 * Imprime la imagen en una sola hoja. En la app de escritorio abre la vista previa en PDF
 * (el diálogo de Windows no muestra la hoja) o, con `vistaPrevia: false`, directo el diálogo de Windows;
 * en el navegador abre su ventana de impresión.
 */
export async function imprimirImagen(imagenUrl, { titulo = 'Documento', pagina = PAGINAS.nota, vistaPrevia = true } = {}) {
  const html = documento(imagenUrl, titulo, pagina);

  const escritorio = window.labtraceEscritorio;
  if (!vistaPrevia && escritorio?.imprimir) {
    const resultado = await escritorio.imprimir(html);
    if (!resultado?.ok) throw new Error(resultado?.message || 'No se pudo imprimir.');
    return;
  }
  if (escritorio?.vistaImpresion) {
    const resultado = await escritorio.vistaImpresion(html, titulo);
    if (!resultado?.ok) throw new Error(resultado?.message || 'No se pudo abrir la vista previa de impresión.');
    return;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  await Promise.all([...doc.images].map((img) => img.decode().catch(() => {})));
  frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
  frame.contentWindow.focus();
  frame.contentWindow.print();
}
