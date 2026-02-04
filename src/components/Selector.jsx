import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';
import { fuzzyMatch } from '../services/fuzzyMatch';

// Selector con búsqueda dentro del dropdown
// - `useFuzzy`: usa fuzzyMatch con `option.searchText` (o label) en vez de substring
// - `groupBy`: agrupa resultados (string key o function(option) -> groupLabel)
const Selector = ({
  options = [],
  onSelect,
  selectedValue,
  className = '',
  disabled = false,
  useFuzzy = false,
  groupBy,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});

  const selectedOption = useMemo(
    () => options.find((o) => String(o.value) === String(selectedValue)),
    [options, selectedValue]
  );

  const norm = (t) => String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  const filtered = useMemo(() => {
    const raw = query.trim();
    const q = norm(raw);
    if (!q) return options;

    if (useFuzzy) {
      return options.filter((o) => {
        const base = o?.searchText != null ? String(o.searchText) : String(o?.label ?? '');
        // fuzzyMatch espera texto ya "normalizado"; normalizamos acá para hacerlo robusto.
        const text = norm(base);
        return fuzzyMatch(text, raw);
      });
    }

    return options.filter((o) => norm(o.label).includes(q));
  }, [options, query, useFuzzy]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;

    const getGroup =
      typeof groupBy === 'function'
        ? groupBy
        : (opt) => {
            const key = groupBy;
            return opt?.[key];
          };

    const map = new Map();
    for (const opt of filtered) {
      const groupLabel = String(getGroup(opt) ?? 'Sin categoría');
      if (!map.has(groupLabel)) map.set(groupLabel, []);
      map.get(groupLabel).push(opt);
    }

    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));
    return entries;
  }, [filtered, groupBy]);

  // Cerrar al hacer click fuera y posicionar el menú
  useEffect(() => {
    const handleClickOutside = (e) => {
      const c = containerRef.current;
      const m = menuRef.current;
      if (!c) return;
      if (c.contains(e.target) || (m && m.contains(e.target))) return;
      setIsOpen(false);
      setQuery('');
    };

    const updatePlacement = () => {
      if (!isOpen) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 8;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUp = spaceAbove > spaceBelow; // abre hacia arriba si hay más espacio arriba
      setOpenUpwards(openUp);

      const width = rect.width;
      let left = rect.left;
      const maxWidth = window.innerWidth - 2 * gap;
      const clampedWidth = Math.min(width, maxWidth);
      left = Math.min(Math.max(left, gap), window.innerWidth - gap - clampedWidth);

      const available = Math.max(0, openUp ? spaceAbove : spaceBelow);
      const cap = Math.floor(window.innerHeight * 0.7); // 70vh
      const maxHeight = Math.max(0, Math.min(available, cap));

      const style = {
        position: 'fixed',
        left: `${left}px`,
        width: `${clampedWidth}px`,
        zIndex: 9999,
        maxHeight: `${maxHeight}px`,
      };
      if (openUp) {
        style.bottom = `${window.innerHeight - rect.top + gap}px`;
      } else {
        style.top = `${rect.bottom + gap}px`;
      }
      setMenuStyle(style);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    updatePlacement();
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [isOpen]);

  const handleSelect = (value) => {
    onSelect?.(value);
    setIsOpen(false);
    setQuery('');
  };

  const displayText = selectedOption ? selectedOption.label : 'Seleccione una opción';
  const isDisabled = Boolean(disabled);

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => !isDisabled && setIsOpen((v) => !v)}
        title={selectedOption ? selectedOption.label : ''}
        className={`w-full min-w-0 text-left ${className} ${isDisabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'} flex items-center justify-between gap-2`}
      >
        <span className={`truncate ${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}>{displayText}</span>
        <FiChevronDown className="ml-2 text-gray-500" size={16} />
      </button>

      {/* Dropdown (portal) */}
      {isOpen && !isDisabled && createPortal(
        (
          <div ref={menuRef} style={menuStyle} className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden flex flex-col">
            {!openUpwards && (
              <div className="p-2 border-b border-gray-200">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            )}
            <div className="flex-1 overflow-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">Sin resultados</div>
              ) : (
                (grouped
                  ? grouped.flatMap(([groupLabel, opts]) => [
                      <div
                        key={`__group__${groupLabel}`}
                        className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-t border-gray-200"
                      >
                        {groupLabel}
                      </div>,
                      ...opts.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelect(opt.value)}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${String(opt.value) === String(selectedValue) ? 'bg-primary/10 text-primary' : 'text-gray-900'}`}
                        >
                          {opt.label}
                        </button>
                      )),
                    ])
                  : filtered.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${String(opt.value) === String(selectedValue) ? 'bg-primary/10 text-primary' : 'text-gray-900'}`}
                      >
                        {opt.label}
                      </button>
                    )))
              )}
            </div>
            {openUpwards && (
              <div className="p-2 border-t border-gray-200">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            )}
          </div>
        ),
        document.body
      )}
    </div>
  );
};

export default Selector;

// Usage example:
// <Selector
//   options={optionsArray}
//   onSelect={handleSelect}
//   selectedValue={currentValue}
// />
// optionsArray should be an array of objects like [{ value: '1', label: 'Option 1' }, { value: '2', label: 'Option 2' }] 