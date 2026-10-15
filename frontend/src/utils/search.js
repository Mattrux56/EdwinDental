/** Normaliza texto para búsquedas insensibles a mayúsculas y tildes. */
export function normalizeSearchText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** ¿Alguno de los valores contiene lo buscado? (sin búsqueda, todo coincide) */
export function matchesSearch(query, values) {
  const term = normalizeSearchText(String(query ?? '').trim());
  return !term || values.some((value) => normalizeSearchText(value).includes(term));
}
