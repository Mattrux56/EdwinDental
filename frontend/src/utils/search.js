/** Normaliza texto para búsquedas insensibles a mayúsculas y tildes. */
export function normalizeSearchText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
