import React, { useEffect, useState } from 'react';
import { useApi } from '../../lib/api';
import axiosInstance from "../../axiosInstance";
import Table from '../../components/Table';

export default function BultosPorBodega() {
  const api = useApi();
  const [bodegas, setBodegas] = useState([]);
  const [bodega, setBodega] = useState(0);
  const [bultos, setBultos] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api('/bodegas');
        const lista = Array.isArray(res?.bodegas) ? res.bodegas : Array.isArray(res) ? res : [];
        setBodegas(lista);
      } catch (e) {
        console.error('Error fetching bodegas', e);
      }
    })();
  }, [api]);

  useEffect(() => {
    if (!bodega || bodega === 0) {
      setBultos([]);
      return;
    }
    (async () => {
      try {
        const res = await api(`/inventario/${bodega}/bultos`);
        setBultos(Array.isArray(res) ? res : []);
      } catch (e) {
        console.error('Error fetching bultos', e);
        setBultos([]);
      }
    })();
  }, [bodega, api]);

  const downloadPdf = async (path, body) => {
    try {
      const response = await api.post(path, body, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'etiquetas.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error downloading PDF', e);
      alert('No se pudo descargar el PDF. Ver consola para más info.');
    }
  };

  const columns = [
    { header: 'Identificador', accessor: 'identificador' },
    { header: 'Materia Prima', accessor: 'materiaPrima', Cell: ({ row }) => row.materiaPrima?.nombre || '' },
    { header: 'Unidades Disponibles', accessor: 'unidades_disponibles' },
    { header: 'Acciones', accessor: 'acciones', Cell: ({ row }) => (
      <div className="flex gap-2">
      <button
        className="text-sm text-green-600 hover:underline"
        onClick={(e) => {
          e.preventDefault();
          const id = row.id;
          downloadPdf('/bultos/etiquetas', { ids_bultos: [id] });
        }}
      >
        Descargar etiquetas del lote
      </button>
        {row.lote?.identificador_proveedor ? (
          <button className="text-sm text-green-600 hover:underline" onClick={(e) => { e.preventDefault(); downloadPdf(`/bultos/etiquetas?ids_bultos[]=${encodeURIComponent(row.lote.identificador_proveedor)}`); }}>Descargar etiquetas del lote</button>
        ) : null}
      </div>
    ) }
  ];

  return (
    <div className="p-6 bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Bultos por Bodega</h1>

      <div className="mb-4 max-w-sm">
        <label className="block text-sm font-medium text-gray-700">Selecciona Bodega</label>
        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={bodega} onChange={(e) => setBodega(Number(e.target.value))}>
          <option value={0}>-- Elige bodega --</option>
          {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
      </div>

      <div className="bg-white rounded shadow p-4">
        <Table columns={columns} data={bultos} />
      </div>
    </div>
  );
}
