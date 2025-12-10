import { useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

export default function SidebarDropdown({ icon, label, expanded, children }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 rounded transition hover:bg-gray-100 text-text"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          {expanded && <span className="text-sm">{label}</span>}
        </div>
        {expanded && (
          <span className="text-xl">
            {isOpen ? <FiChevronDown /> : <FiChevronRight />}
          </span>
        )}
      </button>
      {isOpen && expanded && (
        <div className="ml-4 mt-1 flex flex-col gap-1">
          {children}
        </div>
      )}
    </div>
  );
} 