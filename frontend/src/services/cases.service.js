const API_URL = '/api'; // mismo origen: en dev lo reenvía el proxy de Vite, en producción lo sirve Nest

export function apiFetch(path, options = {}) {
  return fetch(`${API_URL}${path}`, options);
}

export async function request(path, options) {
  let res;
  try {
    res = await apiFetch(path, options);
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.');
  }

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? [...new Set(body.message)].join('. ') : body.message || message;
    } catch {
      /* respuesta sin JSON */
    }
    if (res.status === 413) message = 'Una de las imágenes supera el tamaño permitido (8 MB).';
    throw new Error(message);
  }
  return res.json();
}

/** Construye un FormData con campos de texto (omitiendo vacíos) y fotos */
function buildFormData(fields, fotos = []) {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      fd.append(key, String(value).trim());
    }
  });
  fotos.forEach((file) => fd.append('fotos', file));
  return fd;
}

export const casesService = {
  /** GET /cases?search=&archivados= */
  list(search = '', archivados = false) {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (archivados) params.set('archivados', '1');
    const qs = params.toString();
    return request(`/cases${qs ? `?${qs}` : ''}`);
  },

  /** GET /cases/alertas */
  alertas() {
    return request('/cases/alertas');
  },

  /** PATCH /cases/:id */
  update(id, payload) {
    return request(`/cases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  /** PATCH /cases/:id/archivar | /restaurar */
  archivar(id) {
    return request(`/cases/${id}/archivar`, { method: 'PATCH' });
  },
  restaurar(id) {
    return request(`/cases/${id}/restaurar`, { method: 'PATCH' });
  },

  /** DELETE /cases/imagenes/:id (devuelve el caso actualizado) */
  removeImagen(imagenId) {
    return request(`/cases/imagenes/${imagenId}`, { method: 'DELETE' });
  },

  /** GET /cases/stats */
  stats() {
    return request('/cases/stats');
  },

  /** GET /cases/clientes */
  clients() {
    return request('/cases/clientes');
  },

  /** GET /cases/:id */
  getById(id) {
    return request(`/cases/${id}`);
  },

  /** POST /cases */
  create({ codigo, clienteId, clienteNombre, pacienteNombre, doctorNombre, numeroFactura, descripcion, fechaIngreso, fechaEntregaEstimada, fotos }) {
    return request('/cases', {
      method: 'POST',
      body: buildFormData(
        { codigo, clienteId, clienteNombre, pacienteNombre, doctorNombre, numeroFactura, descripcion, fechaIngreso, fechaEntregaEstimada },
        fotos,
      ),
    });
  },

  /** DELETE /cases/:id */
  remove(id) {
    return request(`/cases/${id}`, { method: 'DELETE' });
  },

  /** GET /cases/:id/ticket */
  getTicket(id) {
    return request(`/cases/${id}/ticket`);
  },

  /** GET /cases/publico/:codigo */
  getPublicByCode(codigo) {
    return request(`/cases/publico/${encodeURIComponent(codigo)}`);
  },

  /** PATCH /cases/:id/seguimiento/:seguimientoId (la fecha vacía la quita; las fotos se agregan a las existentes) */
  updateFollowUp(casoId, seguimientoId, { tipo, descripcion, fechaEntregaEstimada, fotos = [] }) {
    const fd = new FormData();
    if (tipo) fd.append('tipo', tipo);
    fd.append('descripcion', descripcion.trim());
    fd.append('fechaEntregaEstimada', fechaEntregaEstimada ?? '');
    fotos.forEach((file) => fd.append('fotos', file));
    return request(`/cases/${casoId}/seguimiento/${seguimientoId}`, { method: 'PATCH', body: fd });
  },

  /** POST /cases/:id/seguimiento */
  addFollowUp(id, { tipo, descripcion, estado, fechaEntregaEstimada, fotos }) {
    return request(`/cases/${id}/seguimiento`, {
      method: 'POST',
      body: buildFormData({ tipo, descripcion, estado, fechaEntregaEstimada }, fotos),
    });
  },
};
