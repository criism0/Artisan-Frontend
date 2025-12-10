// NOTA: Esto es sólo para hacerlo ilegible al ojo humano. No hay mayor protección: El QR se debe cuidar.
const SECRET_KEY = "ArtisanERP";

export function encodeCredentials(user, password) {
  const payload = JSON.stringify({ user, password });
  const encrypted = xorEncrypt(payload, SECRET_KEY);
  // Base64 encode the result
  return btoa(encrypted);
}

export function decodeCredentials(encoded) {
  try {
    // Base64 decode
    const encrypted = atob(encoded);
    const decrypted = xorDecrypt(encrypted, SECRET_KEY);
    const parsed = JSON.parse(decrypted);
    
    if (parsed && typeof parsed.user === 'string' && typeof parsed.password === 'string') {
      return { user: parsed.user, password: parsed.password };
    }
    return null;
  } catch (error) {
    console.error('Failed to decode credentials:', error);
    return null;
  }
}

function xorEncrypt(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function xorDecrypt(text, key) {
  return xorEncrypt(text, key);
}
