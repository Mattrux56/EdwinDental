import { request } from './cases.service.js';

export const cuentasService = {
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
