import { useState } from "react";
import { Camera } from "lucide-react";
import { VisorFotos } from "./EntregaParada";
import { ETIQUETA_FOTO, urlFoto } from "./fotos";

/**
 * Miniaturas de fotos (preparación, carga, vuelta) que se abren en grande. `fotos`: [{ id, nombre,
 * tipo? }]. `tipo` da la etiqueta si las fotos no la traen.
 */
export default function FotosMini({ fotos = [], tipo, vacio = "Sin fotos", tamano = "w-20 h-20" }) {
  const [visor, setVisor] = useState(null);
  const conTipo = fotos.map((f) => ({ ...f, tipo: f.tipo ?? tipo }));
  if (!conTipo.length) {
    return <p className="text-xs text-gray-400 flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> {vacio}</p>;
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {conTipo.map((f, i) => (
          <button key={f.id} type="button" onClick={() => setVisor(i)} className="group" title={`${ETIQUETA_FOTO[f.tipo] ?? "Foto"} — ${f.nombre ?? ""}`}>
            <img src={urlFoto(f.id)} alt={ETIQUETA_FOTO[f.tipo] ?? "Foto"} loading="lazy" className={`${tamano} object-cover rounded-md border border-gray-200 bg-white group-hover:border-primary`} />
          </button>
        ))}
      </div>
      {visor != null && <VisorFotos fotos={conTipo} inicial={visor} onCerrar={() => setVisor(null)} />}
    </>
  );
}
