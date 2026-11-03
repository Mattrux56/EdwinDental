import { request } from './cases.service.js';

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Los formularios piden la lista de clientes cada vez que se abren: se guarda un minuto para no repetir la consulta
const VIGENCIA_MS = 60_000;
let cache = null; // { lista, hasta }

const invalidar = (resultado) => {
  cache = null;
  return resultado;
};

export const clientesService = {
  /** Lista de clientes; `fresco: true` salta la copia guardada (p. ej. al entrar a la pantalla Clientes) */
  async list({ fresco = false } = {}) {
    if (!fresco && cache && cache.hasta > Date.now()) return cache.lista;
    const lista = await request('/clientes');
    cache = { lista, hasta: Date.now() + VIGENCIA_MS };
    return lista;
  },
  create: (payload) => request('/clientes', json('POST', payload)).then(invalidar),
  update: (id, payload) => request(`/clientes/${id}`, json('PATCH', payload)).then(invalidar),
  remove: (id) => request(`/clientes/${id}`, { method: 'DELETE' }).then(invalidar),
};

/** Otras partes de la app (casos, remisiones) cambian el conteo de casos: se descarta la copia */
export const invalidarClientes = () => invalidar();
