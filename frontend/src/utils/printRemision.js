import { formatEstimatedDate, formatMoney, formatRemisionNumber } from './format.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);

function documento(remision) {
  const titulo = remision.tipo === 'ELECTRONICA' ? 'Remisión electrónica' : 'Cuenta de cobro';
  const doctor = remision.doctorNombre ?? remision.caso?.cliente?.nombre;
  const paciente = remision.pacienteNombre ?? remision.caso?.pacienteNombre;
  const lineas = remision.items
    .map((item) => `<tr>
      <td class="num">${esc(item.cantidad)}</td>
      <td>${esc(item.descripcion)}</td>
      <td class="num">${esc(formatMoney(item.valorUnitario))}</td>
      <td class="num">${esc(formatMoney(item.cantidad * item.valorUnitario))}</td>
    </tr>`)
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(titulo)} ${esc(formatRemisionNumber(remision))}</title>
<style>
  @page { margin: 18mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 14px; display: flex; justify-content: space-between; }
  .anulada { color: #c00000; }
  dl { display: grid; grid-template-columns: 150px 1fr; gap: 4px 12px; margin: 0 0 16px; }
  dt { font-weight: bold; }
  dd { margin: 0; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; vertical-align: top; }
  td { text-transform: uppercase; }
  .num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: bold; }
  .letras { margin-top: 12px; font-weight: bold; }
</style>
</head>
<body>
  <h1><span>${esc(titulo)} N° ${esc(formatRemisionNumber(remision))}</span>${remision.anulada ? '<span class="anulada">ANULADA</span>' : ''}</h1>
  <dl>
    <dt>Fecha</dt><dd>${esc(formatEstimatedDate(remision.fecha))}</dd>
    <dt>Doctor(a) / clínica</dt><dd>${esc(doctor || '—')}</dd>
    <dt>Paciente</dt><dd>${esc(paciente || '—')}</dd>
    <dt>No. de orden</dt><dd>${esc(remision.noOrden || remision.caso?.codigo || '—')}</dd>
  </dl>
  <table>
    <thead><tr><th class="num">Cant.</th><th>Descripción</th><th class="num">Valor unitario</th><th class="num">Total</th></tr></thead>
    <tbody>${lineas}</tbody>
    <tfoot><tr><td colspan="3" class="num">Total</td><td class="num">${esc(formatMoney(remision.total))}</td></tr></tfoot>
  </table>
  ${remision.totalEnLetras ? `<p class="letras">Debe la suma de: ${esc(remision.totalEnLetras)}</p>` : ''}
</body>
</html>`;
}

/** Abre la ventana de impresión del navegador con la remisión (no descarga ningún archivo) */
export function imprimirRemision(remision) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(documento(remision));
  doc.close();
  frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
  frame.contentWindow.focus();
  frame.contentWindow.print();
}
