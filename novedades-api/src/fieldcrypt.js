// src/fieldcrypt.js
import crypto from 'crypto';

/*
ENV:
  NOVELTY_ENC_KEY   = clave de 32 bytes en base64 (p.ej. `openssl rand -base64 32`)
  NOVELTY_KEY_ID    = identificador de clave actual, p.ej. "k1"
  NOVELTY_OLD_KEYS  = JSON con claves antiguas para rotación opcional. Ej:
                      [{"id":"k0","key":"<base64>"}]
*/

function b64d(s){ return Buffer.from(s, 'base64'); }
function b64e(b){ return Buffer.from(b).toString('base64'); }

function getActiveKey() {
  const keyB64 = process.env.NOVELTY_ENC_KEY;
  const kid = process.env.NOVELTY_KEY_ID || 'k1';
  if (!keyB64) throw new Error('Falta NOVELTY_ENC_KEY en .env');
  const key = b64d(keyB64);
  if (key.length !== 32) throw new Error('NOVELTY_ENC_KEY debe ser 32 bytes (AES-256) en base64');
  return { kid, key };
}

function getAllKeys() {
  const active = getActiveKey();
  let olds = [];
  try {
    olds = JSON.parse(process.env.NOVELTY_OLD_KEYS || '[]')
      .map(k => ({ id: k.id, key: b64d(k.key) }))
      .filter(k => k.key?.length === 32);
  } catch {}
  // activa primero
  return [{ id: active.kid, key: active.key }, ...olds];
}

export function encryptString(plain) {
  if (plain == null || plain === '') return null;
  const { kid, key } = getActiveKey();
  const iv = crypto.randomBytes(12); // recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Formato empaquetado: v1:kid:base64(iv)|base64(ct)|base64(tag)
  const packed = `v1:${kid}:${b64e(iv)}|${b64e(ciphertext)}|${b64e(tag)}`;
  return packed;
}

export function decryptString(packed) {
  if (!packed) return '';
  try {
    const asStr = Buffer.isBuffer(packed) ? packed.toString('utf8') : String(packed);
    if (!asStr.startsWith('v1:')) {
      // Retrocompatibilidad: si viniera en claro (antes de migrar)
      return asStr;
    }
    const [, kid, rest] = asStr.split(':');
    const [ivB64, ctB64, tagB64] = rest.split('|');
    const iv = b64d(ivB64), ct = b64d(ctB64), tag = b64d(tagB64);

    // Buscar clave por kid; si no está, probar todas (rotación)
    const keys = getAllKeys();
    for (const k of keys) {
      if (k.id !== kid && keys.some(x => x.id === kid)) continue;
      try {
        const key = (k.id === kid) ? k.key : k.key;
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
        return plain;
      } catch {/* probar siguiente */}
    }
    // último intento probando todas si el kid activo no coincidía
    for (const k of keys) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', k.key, iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
        return plain;
      } catch {}
    }
  } catch {}
  return ''; // en fallo, no reveles datos
}