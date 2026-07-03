import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function DynamicCombobox({
  value,
  onChange,
  options,
  onSelect,
  placeholder = "Escribe para buscar...",
}) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const filtered = (value || "").trim()
    ? options.filter((opt) => {
        const q = value.toLowerCase();
        if (typeof opt === "string") return opt.toLowerCase().includes(q);
        return opt.nombre?.toLowerCase().includes(q);
      })
    : options;

  const updatePosition = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, left: r.left, width: r.width });
  };

  useEffect(() => {
    updatePosition();
  }, [open, value]);

  useEffect(() => {
    const onScroll = () => open && updatePosition();
    const onResize = () => open && updatePosition();
    const onClick = (e) => {
      if (!inputRef.current || !open) return;
      const target = e.target;
      if (target === inputRef.current || inputRef.current.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("click", onClick, true);
    };
  }, [open]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      />
      {open && filtered.length > 0 &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 2147483647,
            }}
          >
            <ul className="bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
              {filtered.map((opt, idx) => {
                const isString = typeof opt === "string";
                const label = isString ? opt : opt.nombre;
                const key = isString ? opt : (opt.id ?? idx);
                return (
                  <li
                    key={key}
                    className="px-3 py-2 hover:bg-primary/10 cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(opt);
                      setOpen(false);
                    }}
                  >
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}
