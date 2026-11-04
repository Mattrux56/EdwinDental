import { request } from './cases.service.js';
import { downloadFile } from './download.js';

/** Fecha de hoy en hora local como YYYY-MM-DD (para el nombre del archivo) */
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const cuentasService = {
  /** Excel con todas las remisiones vigentes y su estado de pago (una hoja por cliente + RESUMEN); false si se cancela «Guardar como» */
  exportar: () => downloadFile('/cuentas-cobro/excel', `CUENTAS_${hoyLocal()}.xlsx`),
  /** `periodo` es { anio, mes } o null para todas las cuentas */
  list: (periodo) => request(periodo ? `/cuentas-cobro?anio=${periodo.anio}&mes=${periodo.mes}` : '/cuentas-cobro?todas=1'),
  /** Guarda cuáles remisiones del cliente en el mes quedan pagadas (las demás quedan pendientes) */
  guardarPagos: (clienteId, periodo, pagadas) =>
    request(periodo ? `/cuentas-cobro/${clienteId}/${periodo.anio}/${periodo.mes}/pagos` : `/cuentas-cobro/${clienteId}/pagos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagadas }),
    }),
};
