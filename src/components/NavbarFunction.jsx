import { useState, useEffect } from "react";
import { Link } from "react-router-dom";


export function Dropdown({ label, icon, children, open, onOpen, onClose }) {
    return (
      <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 ${
            open ? "bg-gray-100" : "hover:bg-gray-100"
          }`}
        >
          {icon && <span className="text-base">{icon}</span>}
          <span>{label}</span>
        </button>
  
        {open && (
          <div className="absolute left-0 mt-2 w-[360px] rounded-lg border bg-white shadow-lg p-2 z-50">
            <div className="flex flex-col gap-1">{children}</div>
          </div>
        )}
      </div>
    );
  }
  
export function MenuGroup({ label, icon, children }) {
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 px-2 py-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
          {icon && <span className="text-sm">{icon}</span>}
          <span>{label}</span>
        </div>
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
        {icon && <span className="text-base">{icon}</span>}
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