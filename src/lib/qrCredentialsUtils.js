// NOTA: El QR solo hace el contenido ilegible al ojo humano. No hay mayor protección: El QR se debe cuidar.

export function encodeCredentials(user, password) {
  return btoa(JSON.stringify({ user, password }));
}

export function decodeCredentials(encoded) {
  try {
    const parsed = JSON.parse(atob(encoded));
    if (parsed && typeof parsed.user === 'string' && typeof parsed.password === 'string') {
      return { user: parsed.user, password: parsed.password };
    }
    return null;
  } catch (error) {
    console.error('Failed to decode credentials:', error);
    return null;
  }
}
