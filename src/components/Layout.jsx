import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

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

