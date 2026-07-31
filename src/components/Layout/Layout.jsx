import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

/**
 * El Layout es el ÚNICO dueño del margen de página.
 *
 * Antes cada vista envolvía su contenido en `p-6 bg-background min-h-screen`, encima del
 * `px-6 py-4` que ya ponía este main: 48 px de aire arriba en todas las pantallas, y un
 * `min-h-screen` que forzaba scroll aunque el contenido cupiera de sobra. Las vistas ya no
 * ponen su propio padding — si alguna lo necesita distinto, se cambia acá.
 */
export default function Layout() {
  return (
    <div className="pt-20">
      <Navbar />
      <main className="px-6 py-4">
        <Outlet />
      </main>
    </div>
  );
}

