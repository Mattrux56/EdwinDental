import { request } from './cases.service.js';
import { downloadFile } from './download.js';

export const remisionesService = {
  /** GET /remisiones (opcional: solo las de un caso) */
  list(casoId) {
    return request(casoId ? `/remisiones?casoId=${casoId}` : '/remisiones');
  },

  /** PATCH /remisiones/:id  { fecha?, noOrden?, doctorNombre?, pacienteNombre?, items? } */
  update(id, payload) {
    return request(`/remisiones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  /** POST /productos/importar (Excel .xlsx) */
  importarProductos(archivo) {
    const fd = new FormData();
    fd.append('archivo', archivo);
    return request('/productos/importar', { method: 'POST', body: fd });
  },

  /** GET /remisiones/siguiente-numero */
  siguienteNumero(tipo = 'NORMAL') {
    return request(`/remisiones/siguiente-numero?tipo=${encodeURIComponent(tipo)}`);
  },

  /** GET /productos (lista de precios activa) */
  productos() {
    return request('/productos');
  },

  /** GET /productos/admin (incluye los inactivos) */
  productosAdmin() {
    return request('/productos/admin');
  },

  /** POST /productos */
  createProducto(payload) {
    return request('/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  /** PATCH /productos/:id */
  updateProducto(id, payload) {
    return request(`/productos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  /** POST /remisiones  { casoId, fecha?, noOrden?, items: [{ productoId, cantidad }] } */
  create(payload) {
    return request('/remisiones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  /** PATCH /remisiones/:id/pago  { pagada } */
  marcarPago(id, pagada) {
    return request(`/remisiones/${id}/pago`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagada }),
    });
  },

  /** PATCH /remisiones/:id/reactivar */
  reactivar(id) {
    return request(`/remisiones/${id}/reactivar`, { method: 'PATCH' });
  },

  /** PATCH /remisiones/:id/anular */
  anular(id) {
    return request(`/remisiones/${id}/anular`, { method: 'PATCH' });
  },

};

/** Imprimir una remisión: guarda su archivo de Excel donde elija la persona («Guardar como») */
export function imprimirRemision(id, numero, tipo = 'NORMAL') {
  const etiqueta = tipo === 'ELECTRONICA' ? `FE-${numero ?? id}` : `No_${numero ?? id}`;
  return downloadFile(`/remisiones/${id}/excel`, `REMISION_${etiqueta}.xlsx`);
}

export const downloadListaPrecios = () => downloadFile('/productos/exportar', 'lista_de_precios.xlsx');
