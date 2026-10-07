import { request } from './cases.service.js';

export const cuentasService = {
  list: (anio, mes) => request(`/cuentas-cobro?anio=${anio}&mes=${mes}`),
  marcarPago: (clienteId, anio, mes, pagada) =>
    request(`/cuentas-cobro/${clienteId}/${anio}/${mes}/pago`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagada }),
    }),
};
