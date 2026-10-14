import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const FORMAT = 'scrypt-v1';

export async function hashSurfDrawPassword(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 256) {
    throw new Error('Surf draw password must be 14–256 characters');
  }
  const salt = randomBytes(24);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `${FORMAT}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export function parseSurfDrawPasswordHash(value) {
  if (typeof value !== 'string') return null;
  const [format, encodedSalt, encodedKey, extra] = value.split(':');
  if (format !== FORMAT || extra !== undefined || !encodedSalt || !encodedKey) return null;
  const salt = Buffer.from(encodedSalt, 'base64url');
  const key = Buffer.from(encodedKey, 'base64url');
  if (salt.length !== 24 || key.length !== KEY_LENGTH ||
      salt.toString('base64url') !== encodedSalt || key.toString('base64url') !== encodedKey) return null;
  return { salt, key };
}

export async function verifySurfDrawPassword(password, parsed) {
  // Invalid usernames use the same expensive path as valid ones.
  const candidate = await scrypt(password, parsed.salt, KEY_LENGTH);
  return timingSafeEqual(candidate, parsed.key);
}
