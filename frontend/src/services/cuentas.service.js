import { request } from './cases.service.js';

export const cuentasService = {
  list: (anio, mes) => request(`/cuentas-cobro?anio=${anio}&mes=${mes}`),
  /** Guarda cuáles remisiones del cliente en el mes quedan pagadas (las demás quedan pendientes) */
  guardarPagos: (clienteId, anio, mes, pagadas) =>
    request(`/cuentas-cobro/${clienteId}/${anio}/${mes}/pagos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagadas }),
    }),
};
