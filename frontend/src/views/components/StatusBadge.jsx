import { normalizeEstado } from '../../constants.js';
import { Badge } from './ui.jsx';

const TONES = {
  'En laboratorio': 'lab',
  'En prueba': 'proc',
  Finalizado: 'done',
  arreglo: 'repair',
  Devolución: 'return',
};

/** Estado de un caso con su color */
export default function StatusBadge({ estado }) {
  const estadoVisible = normalizeEstado(estado);
  return <Badge tone={TONES[estadoVisible]}>{estadoVisible}</Badge>;
}
