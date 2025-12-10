// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./auth/AuthContext.jsx";
import Routing from "./Routing";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <Routing />
    </AuthProvider>
  </React.StrictMode>
);
