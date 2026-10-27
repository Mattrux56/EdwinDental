/** Las prótesis son los productos cuya categoría empieza por «PROTESIS» (sin importar mayúsculas ni tildes) */
export function esProtesis(categoria: string): boolean {
  return categoria
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .startsWith('PROTESIS');
}
