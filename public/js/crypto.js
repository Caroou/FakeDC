// End-to-End Encryption (E2EE) using Web Crypto API (AES-GCM 256-bit + PBKDF2)

export function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function deriveKey(roomId, pin = '') {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(roomId + pin),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(roomId),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(text, key) {
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const cipherText = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    iv: bufferToBase64(iv),
    cipherText: bufferToBase64(cipherText)
  };
}

export async function decryptMessage(encryptedData, key) {
  if (!key || !encryptedData || !encryptedData.iv || !encryptedData.cipherText) {
    return '[Mensagem ilegível]';
  }

  try {
    const iv = base64ToBuffer(encryptedData.iv);
    const cipherText = base64ToBuffer(encryptedData.cipherText);
    const decryptedText = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherText
    );
    return new TextDecoder().decode(decryptedText);
  } catch (e) {
    return '[Mensagem criptografada ilegível]';
  }
}
