import { useState, useEffect, Children, isValidElement } from "react";
import { Link } from "react-router-dom";


function hasVisibleLink(children) {
  return Children.toArray(children).some((child) => {
    if (!isValidElement(child)) return false;
    if (child.type === MenuLink) return child.props.isAllowed !== false;
    if (child.props?.children) return hasVisibleLink(child.props.children);
    return false;
  });
}

/** `alinear="derecha"`: los últimos módulos de la barra abren hacia la izquierda para no salirse de la pantalla. */
export function Dropdown({ label, icon, children, open, onOpen, onClose, alinear = "izquierda" }) {

    if (!hasVisibleLink(children)) return null;
    
    return (
      <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
        <button
          type="button"
          aria-expanded={open}
          onClick={open ? onClose : onOpen}
          className={`px-2 py-1.5 rounded-md text-sm flex items-center gap-1.5 whitespace-nowrap ${
            open ? "bg-gray-100" : "hover:bg-gray-100"
          }`}
        >
          {/* Bajo 1280 px sólo el nombre: con los 9 módulos la barra no cabe con íconos. */}
          {icon && <span className="hidden xl:inline text-gray-600 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
          <span>{label}</span>
        </button>
  
        {open && (
          <div className={`absolute ${alinear === "derecha" ? "right-0" : "left-0"} mt-2 w-[300px] rounded-lg border bg-white shadow-lg p-2 z-50`}>
            <div className="flex flex-col gap-1">{children}</div>
          </div>
        )}
      </div>
    );
  }
  
export function MenuGroup({ label, icon, children }) {
  
    if (!hasVisibleLink(children)) return null;

    return (
      <div className="mt-1 first:mt-0">
        {label && (
          <div className="flex items-center gap-2 px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase border-t border-gray-100">
            {icon && <span className="text-sm">{icon}</span>}
            <span>{label}</span>
          </div>
        )}
        <div className="pl-2 flex flex-col">{children}</div>
      </div>
    );
  }
  
export function MenuLink({ to, icon, label, isAllowed=true }) {
    if (!isAllowed) {
      return null;
    }
    const content = (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50">
        {icon && <span className="text-gray-500 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
        <span className="text-sm text-gray-700">{label}</span>
      </div>
    );
    if (!to || to === "#") return <div>{content}</div>;
    return <Link to={to}>{content}</Link>;
  }
  
export function ClockCompact({ locale = "es-CL", showSeconds = true }) {
    const [now, setNow] = useState(new Date());
  
    useEffect(() => {
      const id = setInterval(() => setNow(new Date()), showSeconds ? 1000 : 60000);
      return () => clearInterval(id);
    }, [showSeconds]);
  
    const hora = now.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: showSeconds ? "2-digit" : undefined,
      hour12: false,
    });
  
    const fecha = now.toLocaleDateString(locale, {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  
    return (
      <div className="flex flex-col leading-tight">
        <span className="text-base md:text-lg font-semibold text-gray-800 tabular-nums">{hora}</span>
        <span className="text-[11px] md:text-xs text-gray-500 capitalize">{fecha}</span>
      </div>
    );
  }