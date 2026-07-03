// Función para verificar si un usuario tiene un permiso específico
export const hasPermission = (userRole, permission) => {
    // Si el usuario es admin, tiene todos los permisos
    if (userRole === 'admin') {
      return true;
    }
  
    // Obtener los permisos del rol desde el localStorage
    const rolePermissions = localStorage.getItem(`role_${userRole}`);
    if (!rolePermissions) {
      return false;
    }
  
    // Convertir la cadena de permisos en un array y verificar si contiene el permiso
    const permissions = rolePermissions.split(',').map(p => p.trim());
    return permissions.includes(permission);
  };
  
  // Función para verificar si un usuario tiene cualquiera de los permisos especificados
  export const hasAnyPermission = (userRole, permissions) => {
    return permissions.some(permission => hasPermission(userRole, permission));
  };
  
  // Función para verificar si un usuario tiene todos los permisos especificados
  export const hasAllPermissions = (userRole, permissions) => {
    return permissions.every(permission => hasPermission(userRole, permission));
  };
  
  // Función para cargar los permisos de un rol
  export const loadRolePermissions = async (roleName) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/roles`);
      const roles = await response.json();
      const role = roles.find(r => r.name === roleName);
      
      if (role) {
        localStorage.setItem(`role_${roleName}`, role.description);
        return role.description.split(',').map(p => p.trim());
      }
      return [];
    } catch (error) {
      console.error('Error loading role permissions:', error);
      return [];
    }
  };

  // Función para traducir tipos de scope del inglés al español
  export const translateScopeType = (scopeType) => {
    const translations = {
      'read': 'Leer',
      'write': 'Crear',
      'delete': 'Borrar'
    };
    
    return translations[scopeType?.toLowerCase()] || scopeType;
  };

  // Función para traducir tipos de modelo del inglés al español
  export const translateModelType = (modelType) => {
    const translations = {
      'role': 'Rol'
    };
    
    return translations[modelType?.toLowerCase()] || modelType;
  }; 