const API_URL = '/api'; // mismo origen: en dev lo reenvía el proxy de Vite, en producción lo sirve Nest

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.');
  }

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join('. ') : body.message || message;
    } catch {
      /* respuesta sin JSON */
    }
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
  /** GET /cases?search= */
  list(search = '') {
    const term = search.trim();
    const qs = term ? `?search=${encodeURIComponent(term)}` : '';
    return request(`/cases${qs}`);
  },

  /** GET /cases/stats */
  stats() {
    return request('/cases/stats');
  },

  /** GET /cases/:id */
  getById(id) {
    return request(`/cases/${id}`);
  },

  /** POST /cases */
  create({ clienteNombre, documentoIdentidad, titulo, descripcion, fotos }) {
    return request('/cases', {
      method: 'POST',
      body: buildFormData({ clienteNombre, documentoIdentidad, titulo, descripcion }, fotos),
    });
  },

  /** POST /cases/:id/seguimiento */
  addFollowUp(id, { tipo, descripcion, estado, fotos }) {
    return request(`/cases/${id}/seguimiento`, {
      method: 'POST',
      body: buildFormData({ tipo, descripcion, estado }, fotos),
    });
  },
};
