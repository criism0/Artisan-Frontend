import { FiUser } from "react-icons/fi";
import { useAuth } from "../auth/AuthContext";
import { Link } from "react-router-dom";

export default function UserBar() {
  const { user, logout } = useAuth();

  return (
    <div className="w-full bg-white shadow-sm border border-b px-6 py-4 flex items-center justify-between rounded-lg relative z-10">
      <div className="text-gray-800 text-xl font-semibold">Panel Principal</div>
      <div className="flex items-center space-x-5">
        {user && (
          <div className="flex items-center space-x-3">
            <span className="text-base text-gray-700 font-medium">
              {user.nombre || user.email}
            </span>
            <div className="w-10 h-10 rounded-full border-2 border-green-400 flex items-center justify-center bg-gray-100">
              <FiUser className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        )}
        {user ? (
          <button
            onClick={logout}
            className="text-primary border border-primary hover:bg-gray-100 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-md transition"
          >
            Cerrar sesión
          </button>
        ) : (
          <Link
            to="/login"
            className="text-primary border border-primary hover:bg-gray-100 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-md transition"
          >
            Iniciar sesión
          </Link>
        )}
      </div>
      
    </div>
  );
}
