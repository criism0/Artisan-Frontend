import { useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");

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