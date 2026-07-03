import checkScopes from "../../services/scopeCheck";
import ProtectedRouteMessage from "./ProtectedRouteMessage";

export default function ProtectedRoute({ children, permissions }) {
    const hasAccess = checkScopes(permissions);

    if (!hasAccess) {
        return <ProtectedRouteMessage permissions={permissions}/>
    }
    
    return children;
}