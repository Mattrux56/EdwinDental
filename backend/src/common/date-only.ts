/** Fecha de hoy en hora local del servidor, como YYYY-MM-DD (toISOString() usa UTC y adelanta el día por la noche en Colombia) */
export function todayLocal(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** YYYY-MM-DD → medianoche UTC de ese día (como Prisma guarda y devuelve las columnas de fecha) */
export function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
