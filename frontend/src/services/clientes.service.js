import { request } from './cases.service.js';

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const clientesService = {
  list: () => request('/clientes'),
  create: (payload) => request('/clientes', json('POST', payload)),
  update: (id, payload) => request(`/clientes/${id}`, json('PATCH', payload)),
  remove: (id) => request(`/clientes/${id}`, { method: 'DELETE' }),
};
