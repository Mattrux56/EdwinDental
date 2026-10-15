import { useEffect, useState } from 'react';
import styles from '../../styles/app.module.css';
import { Icon } from './Icon.jsx';

/** Componentes de las barras de filtros de las listas */

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Barra de filtros sobre una lista: búsqueda, selects, fechas… */
export function FilterBar({ children }) {
  return <div className={styles.filterBar}>{children}</div>;
}

/** Caja de búsqueda con lupa */
export function SearchField({ value, onChange, placeholder, label, className, autoFocus = false }) {
  return (
    <label className={className ?? styles.caseSearch}>
      <Icon name="search" size={17} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
      />
    </label>
  );
}

/** Lista desplegable; `options` son textos o { value, label } */
export function SelectFilter({ value, onChange, options, label, className = '' }) {
  return (
    <select className={`${styles.select} ${className}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {options.map((option) => {
        const { value: v, label: texto } = typeof option === 'object' ? option : { value: option, label: option };
        return <option key={v} value={v}>{texto}</option>;
      })}
    </select>
  );
}

/** Fecha con su rótulo encima (Desde, Hasta…) */
export function DateFilter({ label, value, onChange, ariaLabel, className = styles.dateFilter }) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel ?? label} />
    </label>
  );
}

/** Botón tipo píldora que se activa y desactiva */
export function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`${styles.filterBtn} ${active ? styles.filterBtnActive : ''}`} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

/** Fila de píldoras donde se elige una opción */
export function ChipGroup({ options, value, onChange, label }) {
  return (
    <div className={styles.tableFilters} role="group" aria-label={label}>
      {options.map((option) => (
        <Chip key={option} active={value === option} onClick={() => onChange(option)}>{option}</Chip>
      ))}
    </div>
  );
}

const anioValido = (valor) => Number.isInteger(valor) && valor >= 2000 && valor <= 2100;

/**
 * Mes y año. `mes` va de 1 a 12; con `todoElAnio` aparece la opción «Todo el año» (mes 0).
 * Con `flechas` se agregan ‹ › para pasar de un mes al otro. Avisa con onChange(anio, mes).
 */
export function PeriodFilter({ anio, mes, onChange, todoElAnio = false, flechas = false }) {
  // El año se escribe a mano: mientras no sea válido no se aplica, y al salir del campo vuelve al último válido
  const [anioTexto, setAnioTexto] = useState(String(anio));
  useEffect(() => setAnioTexto(String(anio)), [anio]);

  const mover = (delta) => {
    const total = anio * 12 + (Math.max(mes, 1) - 1) + delta;
    const nuevoAnio = Math.floor(total / 12);
    if (anioValido(nuevoAnio)) onChange(nuevoAnio, (total % 12) + 1);
  };
  const opciones = [...(todoElAnio ? [{ value: 0, label: 'Todo el año' }] : []), ...MESES.map((nombre, i) => ({ value: i + 1, label: nombre }))];

  return (
    <div className={styles.periodFilter}>
      {flechas && <button type="button" className={styles.secondaryBtn} onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>}
      <SelectFilter value={mes} onChange={(valor) => onChange(anio, Number(valor))} options={opciones} label="Mes" />
      <input
        className={styles.input}
        type="number"
        min="2000"
        max="2100"
        value={anioTexto}
        onChange={(e) => {
          setAnioTexto(e.target.value);
          const valor = Number(e.target.value);
          if (anioValido(valor)) onChange(valor, mes);
        }}
        onBlur={() => setAnioTexto(String(anio))}
        aria-label="Año"
      />
      {flechas && <button type="button" className={styles.secondaryBtn} onClick={() => mover(1)} aria-label="Mes siguiente">›</button>}
    </div>
  );
}
