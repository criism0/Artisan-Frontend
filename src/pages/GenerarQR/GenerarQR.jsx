import { useState } from "react";
import { encodeCredentials } from "../../lib/qrCredentialsUtils";
import QRCode from "qrcode";
import { toast } from "../../lib/toast";

export default function GenerarQR() {
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Generate QR code for test credentials
  async function generateTestQR() {
    try {
      const testCredentials = encodeCredentials(username, password);

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(testCredentials, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQrImageUrl(qrDataUrl);
    } catch (err) {
      console.error("Error generating QR code:", err);
      toast.error("Error al generar el código QR");
    }
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-text">Generar QR de acceso</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6 ">
        Este código podrá ser escaneado para acceder a la aplicación. Ingresa
        las credenciales para generar un QR.
      </p>

      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Ingresa el nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
        <input
          type="password"
          placeholder="Ingresa la contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
        <button
          onClick={generateTestQR}
          className="w-full bg-primary text-white px-4 py-2 rounded-lg"
        >
          Generar QR
        </button>
      </div>

      {/* Show generated QR */}
      {qrImageUrl && (
        <div className="my-8 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-sm font-medium mb-2">QR generado:</h3>
          <div className="flex justify-center">
            <img
              src={qrImageUrl}
              alt="Generated QR Code"
              className="border rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
