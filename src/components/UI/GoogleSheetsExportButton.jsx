import { useGoogleLogin } from "@react-oauth/google";
import { FileSpreadsheet } from "lucide-react";

const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

/**
 * Botón de exportar a Google Sheets.
 *
 * Encapsula useGoogleLogin para que las páginas no monten el hook cuando
 * VITE_GOOGLE_CLIENT_ID no está configurado (el script GSI de Google lanza
 * una excepción con client_id vacío y dejaba la página en blanco).
 *
 * Props:
 * - onToken: async ({ access_token }) => void — hace la exportación real.
 * - onError: () => void — error de autenticación con Google.
 * - isExporting / disabled / title: presentación del botón.
 * - etiqueta: si viene, se dibuja como botón con texto («Exportar») en vez del ícono suelto, que
 *   no decía qué hacía (Inventario, Fase 5 de la revisión de UI).
 */
const CLASE_CON_TEXTO = "btn border-gray-300 bg-white text-gray-700 hover:bg-gray-50";

export default function GoogleSheetsExportButton({ onToken, onError, isExporting, disabled, title, etiqueta }) {
  if (!GOOGLE_ENABLED) {
    return (
      <button
        type="button"
        disabled
        className={etiqueta ? CLASE_CON_TEXTO : "text-gray-300 cursor-not-allowed"}
        title="Exportación a Google Sheets no configurada (falta VITE_GOOGLE_CLIENT_ID)"
      >
        <FileSpreadsheet className="w-5 h-5" />
        {etiqueta}
      </button>
    );
  }
  return (
    <EnabledExportButton
      onToken={onToken}
      onError={onError}
      isExporting={isExporting}
      disabled={disabled}
      title={title}
      etiqueta={etiqueta}
    />
  );
}

function EnabledExportButton({ onToken, onError, isExporting, disabled, title, etiqueta }) {
  const loginAndExport = useGoogleLogin({
    onSuccess: onToken,
    onError,
    scope: "https://www.googleapis.com/auth/spreadsheets",
  });

  return (
    <button
      type="button"
      onClick={() => loginAndExport()}
      disabled={disabled}
      className={etiqueta ? CLASE_CON_TEXTO : "text-gray-500 hover:text-green-700 disabled:opacity-40"}
      title={title}
    >
      {etiqueta ? (
        <>
          <FileSpreadsheet className="w-4 h-4" />
          {isExporting ? "Exportando…" : etiqueta}
        </>
      ) : isExporting ? (
        <span className="text-xs text-gray-500">Exportando…</span>
      ) : (
        <FileSpreadsheet className="w-5 h-5" />
      )}
    </button>
  );
}
