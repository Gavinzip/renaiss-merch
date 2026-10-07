import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { HttpError } from './http.mjs';

export function authEncryptionKey() {
  const value = process.env.MISSIONS_TOKEN_ENCRYPTION_KEY?.trim() || '';
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value)
    throw new HttpError(503, 'mission_storage_not_configured');
  return key;
}

export function createSecretBox(key = authEncryptionKey()) {
  return {
    seal(value, context) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(context));
      return [iv.toString('base64'), Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]).toString('base64'), cipher.getAuthTag().toString('base64')].join('.');
    },
    unseal(value, context) {
      try {
        const [iv, payload, tag] = value.split('.').map(v => Buffer.from(v, 'base64'));
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(tag);
        return JSON.parse(Buffer.concat([decipher.update(payload), decipher.final()]).toString());
      } catch { throw new HttpError(503, 'mission_storage_key_invalid'); }
    },
  };
}
