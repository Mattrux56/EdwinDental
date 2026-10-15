export const ESTADOS_CASO = [
  'Devolución',
  'En laboratorio',
  'En prueba',
  'Finalizado',
  'arreglo',
] as const;

export const TIPOS_SEGUIMIENTO = [
  'devolucion',
  'prueba',
  'reingreso',
  'entrega',
  'arreglo',
] as const;

export const ESTADO_POR_MOVIMIENTO: Record<(typeof TIPOS_SEGUIMIENTO)[number], (typeof ESTADOS_CASO)[number]> = {
  devolucion: 'Devolución',
  reingreso: 'En laboratorio',
  prueba: 'En prueba',
  entrega: 'Finalizado',
  arreglo: 'arreglo',
};
