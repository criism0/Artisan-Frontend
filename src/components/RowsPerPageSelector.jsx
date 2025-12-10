import { useState } from 'react';

export default function RowsPerPageSelector({
  onRowsChange,
  value,
  defaultValue = 10,
  options = [10, 25, 50, 100],
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);

  const handleChange = (event) => {
    const newValue = parseInt(event.target.value, 10);
    if (!Number.isNaN(newValue)) {
      if (!isControlled) setInternalValue(newValue);
      if (typeof onRowsChange === 'function') onRowsChange(newValue);
    }
  };

  const currentValue = isControlled ? String(value) : String(internalValue);

  return (
    <div className="flex justify-start">
      <select
        aria-label="Filas por página"
        value={currentValue}
        onChange={handleChange}
        className="px-4 py-2 border border-border rounded-lg bg-white text-text"
      >
        {options.map((option) => (
          <option key={option} value={String(option)}>
            Mostrar {option}
          </option>
        ))}
      </select>
    </div>
  );
}