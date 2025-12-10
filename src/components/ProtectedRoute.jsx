// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
}
