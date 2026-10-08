const dateTime = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const estimatedDateOnly = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export const formatDateTime = (iso) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso) => (iso ? dateOnly.format(new Date(iso)) : '—');
export const formatEstimatedDate = (iso) =>
  iso ? estimatedDateOnly.format(new Date(iso)) : '—';

export function deliverySla(fecha) {
  if (!fecha) return null;
  const [year, month, day] = fecha.slice(0, 10).split('-').map(Number);
  const due = Date.UTC(year, month - 1, day);
  const today = new Date();
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((due - currentDay) / 86400000);
  if (daysLeft < 0) return { label: 'Vencido', status: 'overdue' };
  if (daysLeft <= 2) return { label: 'Por vencer', status: 'dueSoon' };
  return { label: 'A tiempo', status: 'onTime' };
}

/** Fecha del último movimiento de un caso (último seguimiento) */
export const lastMovement = (caso) => {
  const list = caso?.seguimientos ?? [];
  return list.length ? list[list.length - 1].creadoEn : caso?.creadoEn;
};

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
export const formatMoney = (value) => money.format(value ?? 0);
export const formatRemisionNumber = (remision) =>
  remision?.tipo === 'ELECTRONICA' ? `FE-${remision.numero}` : String(remision?.numero ?? '');
