import { useEffect, useRef, useState } from 'react';
import ds from '../../styles/ds.module.css';
import { Icon } from './Icon.jsx';

/** Controles compartidos del sistema de diseño. Estilos en styles/ds.module.css */

const cx = (...clases) => clases.filter(Boolean).join(' ');

/** Control con su etiqueta siempre visible (para filtros): <Field label="Mes">…</Field> */
export function Field({ label, children, className = '' }) {
  return (
    <div className={cx(ds.field, className)}>
      <span className={ds.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Elegir una opción entre pocas, todas a la vista.
 * options: [{ value, label, count?, disabled?, title? }] · onChange(value)
 */
export function Segmented({ options, value, onChange, label, disabled = false }) {
  return (
    <div className={ds.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cx(ds.segment, value === option.value && ds.segmentActive)}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          disabled={disabled || option.disabled}
          title={option.title}
        >
          {option.label}
          {option.count !== undefined && <span className={ds.segmentCount}>{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Pestañas para cambiar de sección dentro de una pantalla. tabs: [{ value, label, icon? }] */
export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className={ds.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={cx(ds.tab, value === tab.value && ds.tabActive)}
          onClick={() => onChange(tab.value)}
        >
          {tab.icon && <Icon name={tab.icon} size={16} />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Contenido de un <th> que ordena. `direccion` es 'asc' | 'desc' | null (sin orden activo).
 * Poner `aria-sort` en el <th> con headerProps.
 */
export function SortHeader({ children, direccion = null, onClick, title }) {
  return (
    <button type="button" className={cx(ds.sortHeader, direccion && ds.sortHeaderActive)} onClick={onClick} title={title}>
      {children}
      <span className={ds.sortIcon}>
        <Icon name={direccion === 'asc' ? 'sortAsc' : direccion === 'desc' ? 'sortDesc' : 'sort'} size={14} />
      </span>
    </button>
  );
}

export const ariaSort = (direccion) => (direccion === 'asc' ? 'ascending' : direccion === 'desc' ? 'descending' : 'none');

/** Interruptor con etiqueta (p. ej. Activo / Inactivo) */
export function Switch({ checked, onChange, label, disabled = false, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cx(ds.switch, checked && ds.switchOn)}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      title={title}
    >
      <span className={ds.switchTrack} aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * Menú «Más acciones». items: [{ label, icon?, onClick, tone?: 'danger' | 'warn', disabled?, note?, separator? }]
 * `label` es el texto del botón; sin él, solo muestra los tres puntos (con aria-label «Más acciones»).
 * El panel va en posición fija porque las tablas y modales recortan lo que sobresale.
 */
export function ActionMenu({ items, label, icon = 'more', ariaLabel = 'Más acciones', disabled = false }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState({ top: 0, left: 0 });
  const caja = useRef(null);
  const boton = useRef(null);
  const panel = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    const tecla = (e) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    const cerrar = () => setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', cerrar, true);
    panel.current?.querySelector('button:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, [abierto]);

  const alternar = (e) => {
    e.stopPropagation(); // dentro de filas clicables no debe abrir la fila
    if (!abierto) {
      const r = boton.current.getBoundingClientRect();
      const ancho = 230;
      setPosicion({
        top: r.bottom + 6,
        left: Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8)),
      });
    }
    setAbierto((v) => !v);
  };

  const mover = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const botones = [...panel.current.querySelectorAll('button:not(:disabled)')];
    const i = botones.indexOf(document.activeElement);
    botones[(i + (e.key === 'ArrowDown' ? 1 : -1) + botones.length) % botones.length]?.focus();
  };

  return (
    <div className={ds.menuWrap} ref={caja} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        ref={boton}
        className={cx(ds.menuTrigger, !label && ds.menuTriggerIcon)}
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={label ? undefined : ariaLabel}
        title={label ? undefined : ariaLabel}
        disabled={disabled}
      >
        <Icon name={icon} size={16} />
        {label}
        {label && <Icon name="chevronDown" size={14} />}
      </button>
      {abierto && (
        <div className={ds.menuPanel} style={posicion} role="menu" ref={panel} onKeyDown={mover}>
          {items.map((item) => (
            <div key={item.label}>
              {item.separator && <div className={ds.menuSeparator} role="separator" />}
              <button
                type="button"
                role="menuitem"
                className={cx(ds.menuItem, item.tone === 'danger' && ds.menuItemDanger, item.tone === 'warn' && ds.menuItemWarn)}
                disabled={item.disabled}
                onClick={() => {
                  setAbierto(false);
                  item.onClick();
                }}
              >
                {item.icon && <Icon name={item.icon} size={16} />}
                <span>
                  {item.label}
                  {item.note && <span className={ds.menuNote}>{item.note}</span>}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
