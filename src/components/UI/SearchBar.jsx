import { useState } from "react";

/**
 * `initialValue` existe para las listas que RECUERDAN su búsqueda entre visitas (ver el
 * `persistKey` de DataTable). No es un valor controlado: se usa una sola vez para sembrar el
 * estado interno, porque el input tiene que seguir respondiendo a cada tecla sin esperar a que
 * el padre le devuelva el valor.
 */
export default function SearchBar({ onSearch, initialValue = "" }) {
  const [query, setQuery] = useState(initialValue);

  const handleInputChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    onSearch(value);
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder="Buscar..."
        className="px-4 py-2 border border-border rounded-lg bg-white text-text focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
      />
    </div>
  );
} 