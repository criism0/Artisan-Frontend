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
 */
export default function GoogleSheetsExportButton({ onToken, onError, isExporting, disabled, title }) {
  if (!GOOGLE_ENABLED) {
    return (
      <button
        disabled
        className="text-gray-300 cursor-not-allowed"
        title="Exportación a Google Sheets no configurada (falta VITE_GOOGLE_CLIENT_ID)"
      >
        <FileSpreadsheet className="w-5 h-5" />
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
    />
  );
}

function EnabledExportButton({ onToken, onError, isExporting, disabled, title }) {
  const loginAndExport = useGoogleLogin({
    onSuccess: onToken,
    onError,
    scope: "https://www.googleapis.com/auth/spreadsheets",
  });

  return (
    <button
      onClick={() => loginAndExport()}
      disabled={disabled}
      className="text-gray-500 hover:text-green-700 disabled:opacity-40"
      title={title}
    >
      {isExporting
        ? <span className="text-xs text-gray-500">Exportando…</span>
        : <FileSpreadsheet className="w-5 h-5" />}
    </button>
  );
}
