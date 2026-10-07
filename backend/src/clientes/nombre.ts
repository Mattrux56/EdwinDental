/** Clave para comparar nombres de clientes: sin tildes, mayúsculas ni espacios repetidos */
export function claveNombre(nombre: string): string {
  return nombre
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
