import { useEffect, useState } from 'react';
import styles from '../dashboard.module.css';
import { clientesService } from '../../services/clientes.service.js';
import { clientesParecidos } from '../../utils/clientes.js';

const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : '');

/** Edita los datos del caso (no toca el historial ni las fotos) */
export default function EditCaseForm({ caso, saving, onSubmit, onCancel }) {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState(String(caso.cliente?.id ?? ''));
  const [clienteNuevo, setClienteNuevo] = useState('');
  const [form, setForm] = useState({
    titulo: caso.titulo ?? '',
    pacienteNombre: caso.pacienteNombre ?? '',
    fechaIngreso: dateOnly(caso.fechaIngreso ?? caso.creadoEn),
    fechaEntregaEstimada: dateOnly(caso.fechaEntregaEstimada),
  });

  useEffect(() => {
    let active = true;
    clientesService.list().then((lista) => active && setClientes(lista)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const nuevo = clienteId === '__nuevo';
  const parecidos = nuevo ? clientesParecidos(clienteNuevo, clientes) : [];

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      titulo: form.titulo,
      pacienteNombre: form.pacienteNombre,
      fechaIngreso: form.fechaIngreso,
      fechaEntregaEstimada: form.fechaEntregaEstimada || null, // vacío = quitar la fecha de entrega
    };
    if (nuevo) payload.clienteNombre = clienteNuevo;
    else if (Number(clienteId) !== caso.cliente?.id) payload.clienteId = Number(clienteId);
    onSubmit(payload);
  };

  return (
    <form className={styles.formCard} onSubmit={submit}>
      <div className={styles.formGrid}>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="ec-titulo">Título del caso <span className={styles.required}>*</span></label>
          <input id="ec-titulo" className={styles.input} value={form.titulo} onChange={set('titulo')} required maxLength={200} />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ec-cliente">Cliente</label>
          <select id="ec-cliente" className={styles.select} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            {!clientes.some((c) => c.id === caso.cliente?.id) && <option value={caso.cliente?.id}>{caso.cliente?.nombre}</option>}
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            <option value="__nuevo">Otro cliente (nuevo)…</option>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ec-paciente">Paciente <span className={styles.required}>*</span></label>
          <input id="ec-paciente" className={styles.input} value={form.pacienteNombre} onChange={set('pacienteNombre')} required maxLength={150} />
        </div>
        {nuevo && (
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="ec-cliente-nuevo">Nombre del cliente nuevo <span className={styles.required}>*</span></label>
            <input id="ec-cliente-nuevo" className={styles.input} value={clienteNuevo} onChange={(e) => setClienteNuevo(e.target.value)} required maxLength={150} autoFocus />
            {parecidos.length > 0 && (
              <div className={styles.similarNotice} role="status">
                ¿Es alguno de estos?
                <div className={styles.similarList}>
                  {parecidos.slice(0, 4).map((c) => (
                    <button type="button" key={c.id} className={styles.linkBtn} onClick={() => setClienteId(String(c.id))}>{c.nombre}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ec-ingreso">Fecha de ingreso <span className={styles.required}>*</span></label>
          <input id="ec-ingreso" className={styles.input} type="date" value={form.fechaIngreso} onChange={set('fechaIngreso')} required />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="ec-entrega">Fecha estimada de entrega</label>
          <input id="ec-entrega" className={styles.input} type="date" value={form.fechaEntregaEstimada} onChange={set('fechaEntregaEstimada')} />
          <span className={styles.hint}>Déjala vacía para quitarla.</span>
        </div>
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="submit" className={styles.primaryBtn} disabled={saving || (nuevo && !clienteNuevo.trim())}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  );
}
