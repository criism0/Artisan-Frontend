import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Upload,
  FileText,
  Download,
  X,
  RefreshCw,
  History,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import SearchBar from "../../components/UI/SearchBar";
import { Spinner } from "../../components/UI/Spinner";
import { fuzzyMatch } from "../../services/fuzzyMatch";
import { uploadToS3 } from "../../lib/uploadToS3";
import { api, buildApiUrl } from "../../lib/api";
import { toast } from "../../lib/toast";
import { useConfirm } from "../../components/Modals/ConfirmProvider.jsx";

const formatoFecha = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

// El static middleware del backend en dev (app.ts) no decodifica ctx.path antes
// de buscar el archivo en disco, así que cualquier filename con espacios o no-ASCII
// se sirve con 404. Sanitizamos el nombre del archivo *antes* de subirlo para que
// el s3_key generado por el backend sea solo ASCII y la URL funcione.
const sanitizarNombreArchivo = (name) => {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const limpio = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/(?:^_)|(?:_$)/g, "");
  return (limpio || "archivo") + ext.toLowerCase();
};

const subirArchivoSanitizado = async (file) => {
  const safeName = sanitizarNombreArchivo(file.name);
  const safeFile =
    safeName === file.name
      ? file
      : new File([file], safeName, { type: file.type });
  const s3Ref = await uploadToS3(safeFile);
  // Preservamos el nombre original para mostrarlo en la UI; el s3_key apunta
  // al archivo con nombre sanitizado en disco, así la URL del preview funciona.
  return { ...s3Ref, original_name: file.name };
};

const formatoTamano = (bytes) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const poeToSearchText = (p) =>
  [p.codigo, p.nombre, p.version, p.documento?.original_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export default function POEsList() {
  const [poes, setPoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("activos");
  // Cache de todas las versiones (activas + inactivas). null = aún no cargado.
  // Se invalida en cada recarga/mutación y se rellena bajo demanda cuando el
  // filtro cambia a "inactivos" o "todos", porque GET /calidad/poes solo trae activos.
  const [historico, setHistorico] = useState(null);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const cargarPOEs = async () => {
    setLoading(true);
    try {
      const res = await api("/calidad/poes?limit=100&page=1", { method: "GET" });
      setPoes(res?.data ?? []);
      setHistorico(null);
    } catch (error) {
      toast.error("Error cargando documentos: " + (error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPOEs();
  }, []);

  const cargarHistorico = useCallback(async () => {
    if (poes.length === 0) {
      setHistorico([]);
      return;
    }
    setLoadingHistorico(true);
    try {
      const arrays = await Promise.all(
        poes.map((p) =>
          api(`/calidad/poes/${p.id}/versiones`, { method: "GET" })
            .then((r) => r?.data ?? [])
            .catch(() => []),
        ),
      );
      const unique = Array.from(
        new Map(arrays.flat().map((p) => [p.id, p])).values(),
      );
      setHistorico(unique);
    } finally {
      setLoadingHistorico(false);
    }
  }, [poes]);

  useEffect(() => {
    if (
      (filtroEstado === "inactivos" || filtroEstado === "todos") &&
      historico === null &&
      !loadingHistorico
    ) {
      cargarHistorico();
    }
  }, [filtroEstado, historico, loadingHistorico, cargarHistorico]);

  const filtered = useMemo(() => {
    const fuente =
      filtroEstado === "activos" ? poes : historico ?? [];
    const porEstado =
      filtroEstado === "inactivos"
        ? fuente.filter((p) => !p.activo)
        : fuente;
    if (!searchQuery.trim()) return porEstado;
    return porEstado.filter((p) =>
      fuzzyMatch(poeToSearchText(p), searchQuery),
    );
  }, [poes, historico, filtroEstado, searchQuery]);

  const handleNuevoPOE = (poe) => {
    setPoes((prev) => [poe, ...prev]);
    setHistorico(null);
  };

  const cargandoListado =
    loading ||
    ((filtroEstado === "inactivos" || filtroEstado === "todos") &&
      historico === null);

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text">Documentos POE</h1>
            <p className="text-sm text-gray-500 mt-1">
              Procedimientos Operativos Estandarizados almacenados en S3.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={cargarPOEs}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Ver documentos
            </button>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm inline-flex items-center gap-2"
            >
              <Upload size={16} />
              Subir documento
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden text-sm">
            {[
              { key: "activos", label: "Activos" },
              { key: "inactivos", label: "Inactivos" },
              { key: "todos", label: "Todos" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFiltroEstado(opt.key)}
                className={`px-3 py-1.5 transition ${
                  filtroEstado === opt.key
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-end">
            <SearchBar onSearch={setSearchQuery} />
            <span className="text-[11px] text-gray-500 mt-1">
              Busca por código o nombre
            </span>
          </div>
        </div>

        {cargandoListado ? (
          <div className="bg-white p-10 rounded-lg shadow flex justify-center">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-500 text-sm">
              {poes.length === 0
                ? "No hay documentos POE cargados aún. Sube uno para comenzar."
                : filtroEstado === "inactivos"
                  ? "No hay POEs inactivos."
                  : "No se encontraron documentos que coincidan con la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreviewDoc(p)}
                className="text-left bg-white p-5 rounded-lg shadow hover:shadow-md hover:border-primary border border-transparent transition"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <FileText size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        {p.nombre}
                      </h3>
                      {!p.activo && (
                        <span className="px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 rounded shrink-0">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {p.codigo} · Versión {p.version}
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Subido:</span>
                    <span>{formatoFecha(p.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tamaño:</span>
                    <span>{formatoTamano(p.documento?.size)}</span>
                  </div>
                  {p.documento?.original_name && (
                    <div className="flex justify-between">
                      <span>Archivo:</span>
                      <span className="truncate ml-2">
                        {p.documento.original_name}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {uploadModalOpen && (
        <UploadPOEModal
          onClose={() => setUploadModalOpen(false)}
          onSuccess={(poe) => {
            handleNuevoPOE(poe);
            setUploadModalOpen(false);
          }}
        />
      )}

      {previewDoc && (
        <PreviewPOEModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onChanged={cargarPOEs}
          onSwitchDoc={(nuevoDoc) => setPreviewDoc(nuevoDoc)}
        />
      )}
    </div>
  );
}

function UploadPOEModal({ onClose, onSuccess }) {
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    codigo.trim().length > 0 &&
    nombre.trim().length > 0 &&
    file != null &&
    !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const s3Ref = await subirArchivoSanitizado(file);

      const documento = {
        s3_key: s3Ref.s3_key,
        s3_bucket: s3Ref.s3_bucket,
        original_name: s3Ref.original_name ?? file.name,
        mime_type: s3Ref.mime_type ?? file.type,
        size: s3Ref.size ?? file.size,
      };

      const created = await api("/calidad/poes", {
        method: "POST",
        body: {
          codigo: codigo.trim(),
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          documento,
        },
      });

      toast.success("Documento subido correctamente");
      onSuccess(created);
    } catch (error) {
      toast.error("Error al subir documento: " + (error?.message || error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Subir documento POE</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej: POE-04"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Control de Higiene"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Opcional"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
            {file && (
              <p className="text-xs text-gray-500 mt-1">
                {file.name} · {formatoTamano(file.size)}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Subiendo..." : "Subir"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PreviewPOEModal({ doc, onClose, onChanged, onSwitchDoc }) {
  const [url, setUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [versionesOpen, setVersionesOpen] = useState(false);
  const [nuevaVersionOpen, setNuevaVersionOpen] = useState(false);
  const confirm = useConfirm();

  const original_name = doc.documento?.original_name;
  const mime_type = doc.documento?.mime_type;
  const size = doc.documento?.size;

  const isPdf =
    (mime_type || "").includes("pdf") || /\.pdf$/i.test(original_name || "");
  const isImage = (mime_type || "").startsWith("image/");

  useEffect(() => {
    let cancelled = false;
    setLoadingUrl(true);
    api(`/calidad/poes/${doc.id}`, { method: "GET" })
      .then((data) => {
        if (!cancelled) setUrl(buildApiUrl(data?.documento_url));
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error("No se pudo obtener la URL del documento: " + (err?.message || err));
          setUrl("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingUrl(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.id]);

  const handleToggleActive = async () => {
    if (mutating) return;
    setMutating(true);
    try {
      const res = await api(`/calidad/poes/${doc.id}/toggle-active`, {
        method: "POST",
      });
      const updated = res?.data ?? res;
      toast.success(updated?.activo ? "POE activado" : "POE desactivado");
      onSwitchDoc({ ...doc, activo: updated?.activo ?? !doc.activo });
      onChanged?.();
    } catch (error) {
      toast.error("Error al cambiar estado: " + (error?.message || error));
    } finally {
      setMutating(false);
    }
  };

  const handleDelete = async () => {
    if (mutating) return;
    if (!(await confirm({
      title: "¿Eliminar POE?",
      message: `El POE "${doc.codigo} v${doc.version}" se eliminará permanentemente. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      danger: true,
    }))) {
      return;
    }
    setMutating(true);
    try {
      await api(`/calidad/poes/${doc.id}`, { method: "DELETE" });
      toast.success("POE eliminado");
      onChanged?.();
      onClose();
    } catch (error) {
      toast.error("Error al eliminar: " + (error?.message || error));
      setMutating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800 truncate">
                {doc.nombre}
              </h2>
              {!doc.activo && (
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 rounded">
                  Inactivo
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {doc.codigo} · Versión {doc.version} · Subido {formatoFecha(doc.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setVersionesOpen(true)}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-100 inline-flex items-center gap-2"
            >
              <History size={14} />
              Versiones
            </button>
            <button
              onClick={() => setNuevaVersionOpen(true)}
              disabled={mutating}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-100 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Plus size={14} />
              Nueva versión
            </button>
            <button
              onClick={handleToggleActive}
              disabled={mutating}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-100 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Power size={14} />
              {doc.activo ? "Desactivar" : "Activar"}
            </button>
            <button
              onClick={handleDelete}
              disabled={mutating}
              className="px-3 py-1.5 border border-red-300 text-red-700 rounded text-sm hover:bg-red-50 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={14} />
              Eliminar
            </button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <Download size={14} />
                Descargar
              </a>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 p-1"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100">
          {loadingUrl ? (
            <div className="h-full flex items-center justify-center">
              <Spinner />
            </div>
          ) : !url ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <FileText size={48} className="text-gray-400 mb-3" />
              <p className="text-gray-600 text-sm">
                No hay URL disponible para previsualizar este documento.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {original_name} · {formatoTamano(size)}
              </p>
            </div>
          ) : isPdf ? (
            <iframe
              title={doc.nombre}
              src={url}
              className="w-full h-full border-0"
            />
          ) : isImage ? (
            <div className="h-full flex items-center justify-center p-4">
              <img
                src={url}
                alt={doc.nombre}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <FileText size={48} className="text-gray-400 mb-3" />
              <p className="text-gray-600 text-sm">
                Este tipo de archivo no se puede previsualizar en el navegador.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <Download size={14} />
                Abrir archivo
              </a>
            </div>
          )}
        </div>
      </div>

      {versionesOpen && (
        <VersionesModal
          poe={doc}
          onClose={() => setVersionesOpen(false)}
          onSelect={(version) => {
            setVersionesOpen(false);
            onSwitchDoc(version);
          }}
        />
      )}

      {nuevaVersionOpen && (
        <NuevaVersionModal
          poe={doc}
          onClose={() => setNuevaVersionOpen(false)}
          onSuccess={(nuevaVersion) => {
            setNuevaVersionOpen(false);
            onChanged?.();
            onSwitchDoc(nuevaVersion);
          }}
        />
      )}
    </div>
  );
}

function VersionesModal({ poe, onClose, onSelect }) {
  const [versiones, setVersiones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api(`/calidad/poes/${poe.id}/versiones`, { method: "GET" })
      .then((res) => {
        if (!cancelled) setVersiones(res?.data ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error("Error cargando versiones: " + (err?.message || err));
          setVersiones([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [poe.id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800 truncate">
              Versiones de {poe.codigo}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {poe.nombre}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : versiones.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">
              No se encontraron versiones.
            </p>
          ) : (
            <ul className="space-y-2">
              {versiones.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => onSelect(v)}
                    className={`w-full text-left p-3 rounded-lg border transition hover:border-primary hover:bg-blue-50 ${
                      v.id === poe.id
                        ? "border-primary bg-blue-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-gray-800 text-sm">
                          v{v.version}
                        </span>
                        {v.activo ? (
                          <span className="px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-green-100 text-green-700 rounded">
                            Activa
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 rounded">
                            Inactiva
                          </span>
                        )}
                        {v.id === poe.id && (
                          <span className="text-[10px] text-primary">
                            (actual)
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {formatoFecha(v.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {v.documento?.original_name} · {formatoTamano(v.documento?.size)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function NuevaVersionModal({ poe, onClose, onSuccess }) {
  const [nombre, setNombre] = useState(poe.nombre ?? "");
  const [descripcion, setDescripcion] = useState(poe.descripcion ?? "");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    nombre.trim().length > 0 && file != null && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const s3Ref = await subirArchivoSanitizado(file);

      const documento = {
        s3_key: s3Ref.s3_key,
        s3_bucket: s3Ref.s3_bucket,
        original_name: s3Ref.original_name ?? file.name,
        mime_type: s3Ref.mime_type ?? file.type,
        size: s3Ref.size ?? file.size,
      };

      const updated = await api(`/calidad/poes/${poe.id}`, {
        method: "PUT",
        body: {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          documento,
        },
      });

      toast.success(`Nueva versión v${updated?.version ?? "?"} creada`);
      onSuccess(updated);
    } catch (error) {
      toast.error("Error al crear nueva versión: " + (error?.message || error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Subir nueva versión
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Se creará la versión {(poe.version ?? 0) + 1} de{" "}
          <span className="font-semibold text-gray-700">{poe.codigo}</span>. La
          versión actual quedará marcada como inactiva.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código
            </label>
            <input
              type="text"
              value={poe.codigo ?? ""}
              readOnly
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo nuevo <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
              required
            />
            {file && (
              <p className="text-xs text-gray-500 mt-1">
                {file.name} · {formatoTamano(file.size)}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Subiendo..." : "Crear versión"}
          </button>
        </div>
      </form>
    </div>
  );
}
