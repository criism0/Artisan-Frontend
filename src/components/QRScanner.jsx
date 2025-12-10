import React, { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { decodeCredentials } from "../lib/qrCredentialsUtils";

export default function QRScanner({ onScanSuccess, onClose }) {
  const [error, setError] = useState("");
  const [scanner, setScanner] = useState(null);
  const [showPermissionButton, setShowPermissionButton] = useState(false);

  const permissionState = {
    GRANTED: "granted",
    DENIED: "denied",
    PROMPT: "prompt",
  };

  const isInitializingRef = useRef(false);
  const hasScannedRef = useRef(false); // Use ref instead of state

  useEffect(() => {
    initializeScannerWithPermissionCheck();
    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, []);

  async function initializeScannerWithPermissionCheck() {
    if (isInitializingRef.current) {
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: "camera" });

      if (permission.state === permissionState.GRANTED) {
        initializeScanner();
      } else if (permission.state === permissionState.DENIED) {
        setError(
          "Acceso a la cámara denegado. Por favor, habilita la cámara en la configuración del navegador."
        );
        setShowPermissionButton(true);
      } else {
        setShowPermissionButton(true);
      }
    } catch (err) {
      console.log(
        "Permissions API not supported, trying to initialize scanner"
      );
      initializeScanner();
    }
  }

  async function requestCameraAccess() {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream as we just needed to request permission
      stream.getTracks().forEach((track) => track.stop());
      setShowPermissionButton(false);
      initializeScanner();
    } catch (err) {
      console.error("Camera access denied:", err);
      setError(
        "No se pudo acceder a la cámara. Por favor, permite el acceso a la cámara y recarga la página."
      );
      setShowPermissionButton(true);
    }
  }

  function initializeScanner() {
    if (isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;

    try {
      const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        },
        false
      );

      html5QrcodeScanner.render((decodedText, decodedResult) => {
        handleQRCodeDetected(decodedText);
      });

      setScanner(html5QrcodeScanner);
    } catch (err) {
      console.error("Scanner initialization error:", err);
      setError(
        "No se pudo inicializar el escáner. Por favor, verifica que tienes acceso a la cámara."
      );
      setShowPermissionButton(true);
    }
  }

  function handleQRCodeDetected(qrData) {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;

    // Clear scanner immediately
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }

    // Try to decode credentials
    const credentials = decodeCredentials(qrData);

    if (credentials) {
      onScanSuccess(credentials);
    } else {
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.user && parsed.password) {
          onScanSuccess({ user: parsed.user, password: parsed.password });
        } else {
          setError("QR Code no contiene credenciales válidas");
        }
      } catch {
        setError("QR Code no contiene credenciales válidas");
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Escanear QR</h2>
          <button
            onClick={() => {
              if (scanner) {
                scanner.clear();
              }
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {showPermissionButton && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <p className="mb-2">
              Se necesita acceso a la cámara para escanear códigos QR.
            </p>
            <button
              onClick={requestCameraAccess}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Permitir acceso a la cámara
            </button>
          </div>
        )}

        <div className="relative bg-gray-300 rounded-lg overflow-hidden">
          <div id="qr-reader" className="w-full"></div>
        </div>

        <p className="mt-4 text-sm text-gray-600 text-center">
          Apunta la cámara hacia el código QR para iniciar sesión
          automáticamente.
        </p>
      </div>
    </div>
  );
}
