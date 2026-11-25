/**
 * Un ícono por concepto (Fase 3 de la revisión de UI, 2026-11-25). Las mismas claves están en la app
 * (`Mobile/artisan/constants/iconos.ts`) con el equivalente de Ionicons más parecido: el dibujo de un
 * concepto es el mismo en la web y en el teléfono. Comparación visual aprobada por Cristóbal.
 *
 * Si un concepto cambia de ícono acá, cambiarlo también en la app.
 */
import {
  Archive, Award, BookOpen, Box, ClipboardCheck, CircleMinus, CornerDownLeft, Factory, Handshake,
  Inbox, MapPinned, Settings, ShoppingBag, ShoppingCart, Truck, Warehouse,
} from "lucide-react";

export const ICONOS = {
  // Módulos del menú
  adquisiciones: ShoppingBag,
  produccion: Factory,
  logistica: Truck,
  inventario: Warehouse,
  ventas: ShoppingCart,
  calidad: Award,
  comercial: Handshake,
  catalogo: BookOpen,
  admin: Settings,
  // Conceptos que también están en la app
  ordenesVenta: ShoppingCart, // app: cart-outline
  entregas: MapPinned, // app: map-outline
  devoluciones: CornerDownLeft, // app: return-down-back-outline
  solicitudes: Inbox, // app: file-tray-outline
  recepcion: Archive, // app: archive-outline
  stock: Box, // app: cube-outline
  tomas: ClipboardCheck, // app: clipboard-outline
  consumoInterno: CircleMinus, // app: remove-circle-outline
};
