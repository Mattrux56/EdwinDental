import { useEffect, useState } from 'react';
import styles from '../dashboard.module.css';
import PhotoPicker from './PhotoPicker.jsx';
import { casesService } from '../../services/cases.service.js';
import { clientesParecidos } from '../../utils/clientes.js';

const today = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const initialForm = () => ({
  clienteNombre: '',
  pacienteNombre: '',
  titulo: '',
  descripcion: '',
  fechaIngreso: today(),
  fechaEntregaEstimada: '',
});

export default function NewCaseForm({ saving, onSubmit, onCancel }) {
  const [form, setForm] = useState(initialForm);
  const [fotos, setFotos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [clientError, setClientError] = useState('');

  useEffect(() => {
    let active = true;
    casesService.clients()
      .then((data) => {
        if (active) setClientes(data);
      })
      .catch((error) => {
        if (active) setClientError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const parecidos = !clienteId ? clientesParecidos(form.clienteNombre, clientes) : [];

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = clienteId
      ? { ...form, clienteId: Number(clienteId), clienteNombre: undefined, fotos }
      : { ...form, fotos };
    const created = await onSubmit(payload);
    if (created) {
      setForm(initialForm());
      setFotos([]);
      setClienteId('');
    }
  };

  return (
      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="clienteExistente">
              Cliente
            </label>
            <select
              id="clienteExistente"
              className={styles.select}
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
            >
              <option value="">Registrar un cliente nuevo</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre} · {cliente._count.casos} {cliente._count.casos === 1 ? 'caso' : 'casos'}
                </option>
              ))}
            </select>
            {clientError && <span className={styles.fieldError} role="alert">{clientError}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="clienteNombre">
              {clienteId ? 'Cliente seleccionado' : <>Nombre del cliente <span className={styles.required}>*</span></>}
            </label>
            <input
              id="clienteNombre"
              className={styles.input}
              value={clienteId ? clientes.find((cliente) => String(cliente.id) === clienteId)?.nombre ?? '' : form.clienteNombre}
              onChange={update('clienteNombre')}
              required={!clienteId}
              disabled={Boolean(clienteId)}
              maxLength={150}
              autoComplete="off"
              placeholder={clienteId ? '' : 'Nombre completo'}
            />
            {parecidos.length > 0 && (
              <div className={styles.similarNotice} role="status">
                ¿Es alguno de estos clientes que ya existen?
                <div className={styles.similarList}>
                  {parecidos.slice(0, 4).map((c) => (
                    <button type="button" key={c.id} className={styles.linkBtn} onClick={() => setClienteId(String(c.id))}>
                      {c.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="pacienteNombre">
              Nombre del paciente <span className={styles.required}>*</span>
            </label>
            <input
              id="pacienteNombre"
              className={styles.input}
              value={form.pacienteNombre}
              onChange={update('pacienteNombre')}
              required
              maxLength={150}
              autoComplete="off"
              placeholder="Nombre completo del paciente"
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="titulo">
              Título del caso <span className={styles.required}>*</span>
            </label>
            <input
              id="titulo"
              className={styles.input}
              value={form.titulo}
              onChange={update('titulo')}
              required
              maxLength={200}
              placeholder="Ej.: Prótesis parcial superior — ajuste de oclusión"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="fechaIngreso">
              Fecha de ingreso <span className={styles.required}>*</span>
            </label>
            <input
              id="fechaIngreso"
              className={styles.input}
              type="date"
              value={form.fechaIngreso}
              onChange={update('fechaIngreso')}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="fechaEntregaEstimada">
              Fecha Estimada de Entrega
            </label>
            <input
              id="fechaEntregaEstimada"
              className={styles.input}
              type="date"
              value={form.fechaEntregaEstimada}
              onChange={update('fechaEntregaEstimada')}
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="descripcion">
              Descripción del ingreso <span className={styles.required}>*</span>
            </label>
            <textarea
              id="descripcion"
              className={styles.textarea}
              value={form.descripcion}
              onChange={update('descripcion')}
              required
              maxLength={5000}
              placeholder="Estado en que llega la muestra o pieza, observaciones y trabajo solicitado"
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <span className={styles.label}>Fotografías del ingreso</span>
            <PhotoPicker files={fotos} onChange={setFotos} />
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar caso'}
          </button>
        </div>
      </form>
  );
}
