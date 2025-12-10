export const proveedores = [
  {
    id: 1,
    nombre: "Lechera del Sur S.A.",
    insumos: [
      { id: 1, nombre: "Leche en Polvo", precio_unitario: 2500 },
      { id: 2, nombre: "Suero de Leche", precio_unitario: 1500 },
      { id: 3, nombre: "Caseína", precio_unitario: 3500 }
    ]
  },
  {
    id: 2,
    nombre: "Envases Industriales Ltda.",
    insumos: [
      { id: 4, nombre: "Botellas PET 1L", precio_unitario: 120 },
      { id: 5, nombre: "Tapas de Botella", precio_unitario: 15 },
      { id: 6, nombre: "Etiquetas", precio_unitario: 25 }
    ]
  },
  {
    id: 3,
    nombre: "Cultivos Lácticos S.A.",
    insumos: [
      { id: 7, nombre: "Cultivo Láctico", precio_unitario: 4500 },
      { id: 8, nombre: "Enzimas", precio_unitario: 2800 },
      { id: 9, nombre: "Colorante Natural", precio_unitario: 3200 }
    ]
  }
];

export const lugares = [
  { id: 1, nombre: "Bodega Central" },
  { id: 2, nombre: "Planta de Producción" },
  { id: 3, nombre: "Centro de Distribución" }
];

// Función para simular una petición GET de proveedores
export const getProveedores = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(proveedores);
    }, 500);
  });
};

// Función para simular una petición GET de lugares
export const getLugares = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(lugares);
    }, 500);
  });
}; 