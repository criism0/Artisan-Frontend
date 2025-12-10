export const ordenes = [
  {
    id: 1,
    numero: "OC-001",
    fecha_emision: "2024-03-15",
    total: "$1,500,000",
    estado: "Creada",
    proveedor: "Lechera del Sur S.A.",
    lugar: "Bodega Central",
    condiciones: "Pago a 30 días",
    insumos: [
      { nombre: "Leche en Polvo", cantidad: 100, precio_unitario: 2500 },
      { nombre: "Suero de Leche", cantidad: 50, precio_unitario: 1500 },
      { nombre: "Caseína", cantidad: 75, precio_unitario: 3500 }
    ]
  },
  {
    id: 2,
    numero: "OC-002",
    fecha_emision: "2024-03-14",
    total: "$2,300,000",
    estado: "Validada",
    proveedor: "Envases Industriales Ltda.",
    lugar: "Planta de Producción",
    condiciones: "Pago a 60 días",
    insumos: [
      { nombre: "Botellas PET 1L", cantidad: 1000, precio_unitario: 120 },
      { nombre: "Tapas de Botella", cantidad: 2000, precio_unitario: 15 },
      { nombre: "Etiquetas", cantidad: 1500, precio_unitario: 25 }
    ]
  },
  {
    id: 3,
    numero: "OC-003",
    fecha_emision: "2024-03-13",
    total: "$950,000",
    estado: "Enviada",
    proveedor: "Cultivos Lácticos S.A.",
    lugar: "Centro de Distribución",
    condiciones: "Pago a 45 días",
    insumos: [
      { nombre: "Cultivo Láctico", cantidad: 10, precio_unitario: 4500 },
      { nombre: "Enzimas", cantidad: 5, precio_unitario: 2800 },
      { nombre: "Colorante Natural", cantidad: 8, precio_unitario: 3200 }
    ]
  }
];

// Función para simular una petición GET
export const getOrdenes = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(ordenes);
    }, 500); // Simulamos un delay de 500ms
  });
};

// Función para simular una petición GET de una orden específica
export const getOrdenById = (id) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log("Searching for order with ID:", id);
      console.log("Available orders:", ordenes);
      const orden = ordenes.find(o => o.id === id);
      console.log("Found order:", orden);
      if (orden) {
        resolve(orden);
      } else {
        reject(new Error('Orden no encontrada'));
      }
    }, 500);
  });
};

// Función para simular una petición PUT (actualización)
export const updateOrden = (id, updatedData) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const index = ordenes.findIndex(o => o.id === parseInt(id));
      if (index !== -1) {
        ordenes[index] = { ...ordenes[index], ...updatedData };
        resolve(ordenes[index]);
      } else {
        reject(new Error('Orden no encontrada'));
      }
    }, 500);
  });
}; 