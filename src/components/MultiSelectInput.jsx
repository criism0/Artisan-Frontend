import { useState, useRef, useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export default function MultiSelectInput({ 
  options = [], // Array de opciones disponibles
  selected = [], // Array de opciones seleccionadas
  onSelectionChange, // Callback cuando cambian las selecciones
  placeholder = "Seleccionar...",
  label = "Seleccionar personas",
  error = null,
  disabled = false,
  priorityIds = [] // IDs a priorizar (encargados de bodega)
}) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(options);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Filtrar opciones basado en el input y las selecciones existentes
  useEffect(() => {
    const q = inputValue.trim().toLowerCase();
    const filtered = options
      .filter(option => {
        // No mostrar ya seleccionados
        if (selected.find(item => item.id === option.id)) return false;
        if (!q) return true;
        const name = (option.label || '').toLowerCase();
        const email = (option.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .sort((a, b) => {
        // Priorizar por IDs entregados
        const aPri = priorityIds?.includes?.(a.id) ? 1 : 0;
        const bPri = priorityIds?.includes?.(b.id) ? 1 : 0;
        if (aPri !== bPri) return bPri - aPri; // primero priorizados
        // fallback: orden alfabético por label para consistencia
        return String(a.label || '').localeCompare(String(b.label || ''));
      });
    setFilteredOptions(filtered);
  }, [inputValue, options, selected, priorityIds]);

  // Manejar clic fuera del componente
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = (option) => {
    const selectedUser = {
      id: option.id,
      label: option.label,
      email: option.email
    };
    onSelectionChange([...selected, selectedUser]);
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemove = (optionToRemove) => {
    onSelectionChange(selected.filter(option => option.id !== optionToRemove.id));
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        <div className={`
          min-h-[42px] w-full px-3 py-2 
          border rounded-lg 
          ${error ? 'border-red-500' : 'border-gray-300'} 
          ${disabled ? 'bg-gray-100' : 'bg-white'}
          focus-within:ring-2 focus-within:ring-primary focus-within:border-primary
        `}>
          {/* Chips de selección */}
          <div className="flex flex-wrap gap-2">
            {selected.map(option => (
              <div
                key={option.id}
                className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
              >
                <span>{option.label}</span>
                {!disabled && (
                  <button
                    onClick={() => handleRemove(option)}
                    className="hover:text-primary/80"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            
            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setIsOpen(true)}
              placeholder={selected.length === 0 ? placeholder : ''}
              disabled={disabled}
              className="flex-1 min-w-[120px] outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Dropdown de opciones */}
        {isOpen && filteredOptions.length > 0 && !disabled && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            {filteredOptions.map(option => (
              <button
                key={option.id}
                onClick={() => handleSelect(option)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                <div className="flex flex-col">
                  <span className="text-sm text-gray-900">{option.label}</span>
                  {option.email && (
                    <span className="text-xs text-gray-500">{option.email}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
} 