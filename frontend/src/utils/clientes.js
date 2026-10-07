/** Clave para comparar nombres de clientes: sin tildes, mayúsculas, puntuación ni títulos (Dr., Dra., Doctor…) */
export function nombreKey(nombre = '') {
  return String(nombre)
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((palabra) => palabra && !['dr', 'dra', 'doctor', 'doctora', 'clinica', 'odontologia'].includes(palabra))
    .join(' ');
}

/** Clientes cuyo nombre es igual o contiene al otro (con al menos 4 letras), para avisar de posibles duplicados */
export function clientesParecidos(nombre, clientes) {
  const key = nombreKey(nombre);
  if (key.length < 4) return [];
  return clientes.filter((c) => {
    const otro = nombreKey(c.nombre);
    return otro.length >= 4 && (otro === key || otro.includes(key) || key.includes(otro));
  });
}

/** ids de los clientes que comparten la misma clave de nombre con otro cliente */
export function idsDuplicados(clientes) {
  const porClave = new Map();
  clientes.forEach((c) => {
    const key = nombreKey(c.nombre);
    if (!key) return;
    porClave.set(key, [...(porClave.get(key) ?? []), c.id]);
  });
  return new Set([...porClave.values()].filter((ids) => ids.length > 1).flat());
}
