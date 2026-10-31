import { useState } from 'react';
import styles from '../../styles/app.module.css';

const EMPTY = { codigo: '', categoria: '', descripcion: '', valor: '', tipo: '' }; // tipo vacío = automático

// El tipo fija el orden en la remisión: primero las bases, luego las prótesis y al final los adicionales
const TIPOS = [
  { value: 'BASE', label: 'Base' },
  { value: 'PROTESIS', label: 'Prótesis' },
  { value: 'ADICIONAL', label: 'Adicional' },
];

const OTRA = '__otra';

export default function ProductoForm({ producto, saving, onSubmit, onCancel, categorias = [] }) {
  const [form, setForm] = useState(producto ? {
    codigo: String(producto.codigo),
    categoria: producto.categoria,
    descripcion: producto.descripcion,
    valor: String(producto.valor),
    tipo: producto.tipo ?? '',
  } : EMPTY);

  // Categoría: lista desplegable con las existentes (evita escribirla distinta cada vez); "Otra…" permite crear una nueva
  const opciones = [...new Set([...categorias, ...(producto ? [producto.categoria] : [])])].sort((a, b) => a.localeCompare(b, 'es'));
  const [modoNueva, setModoNueva] = useState(opciones.length === 0);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const saved = await onSubmit({
      codigo: Number(form.codigo),
      categoria: form.categoria.trim(),
      descripcion: form.descripcion.trim(),
      valor: Number(form.valor),
      // Solo si el usuario lo eligió o lo cambió: si no, el servidor lo calcula por nombre y categoría
      ...(form.tipo && form.tipo !== (producto?.tipo ?? '') ? { tipo: form.tipo } : {}),
    });
    if (saved) onCancel();
  };

  return (
    <form className={styles.formCard} onSubmit={submit}>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="producto-codigo">Código *</label>
          <input
            id="producto-codigo"
            className={styles.input}
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={form.codigo}
            onChange={update('codigo')}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="producto-categoria">Categoría *</label>
          {modoNueva ? (
            <>
              <input
                id="producto-categoria"
                className={styles.input}
                value={form.categoria}
                onChange={update('categoria')}
                maxLength={120}
                placeholder="Nombre de la categoría nueva"
                required
                autoFocus={opciones.length > 0}
              />
              {opciones.length > 0 && (
                <button type="button" className={styles.linkBtn} onClick={() => { setModoNueva(false); setForm((f) => ({ ...f, categoria: '' })); }}>
                  Elegir una existente
                </button>
              )}
            </>
          ) : (
            <select
              id="producto-categoria"
              className={styles.select}
              value={form.categoria}
              required
              onChange={(event) => {
                if (event.target.value === OTRA) {
                  setModoNueva(true);
                  setForm((f) => ({ ...f, categoria: '' }));
                } else {
                  setForm((f) => ({ ...f, categoria: event.target.value }));
                }
              }}
            >
              <option value="" disabled>Selecciona…</option>
              {opciones.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={OTRA}>Otra categoría (nueva)…</option>
            </select>
          )}
        </div>
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label} htmlFor="producto-descripcion">Descripción *</label>
          <input
            id="producto-descripcion"
            className={styles.input}
            value={form.descripcion}
            onChange={update('descripcion')}
            maxLength={250}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="producto-valor">Valor (COP) *</label>
          <input
            id="producto-valor"
            className={styles.input}
            type="number"
            min="0"
            max="100000000"
            step="1"
            value={form.valor}
            onChange={update('valor')}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="producto-tipo">Tipo de producto</label>
          <select id="producto-tipo" className={styles.select} value={form.tipo} onChange={update('tipo')}>
            {!producto && <option value="">Automático (según nombre y categoría)</option>}
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <span className={styles.hint}>Define el orden en la remisión: bases, prótesis y adicionales.</span>
        </div>
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? 'Guardando…' : producto ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </form>
  );
}
