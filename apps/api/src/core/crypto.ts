import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Secrets the API has to read back (an authenticator app's TOTP secret,
 * Google's refresh token) are sealed with AES-256-GCM before they reach the
 * database, so a leaked backup is not a working key to anyone's account.
 *
 * The key is APP_ENCRYPTION_KEY: 32 random bytes, base64. It is read when
 * used, not at boot, so the features that need it stay optional. Lose the key
 * and every sealed value is gone: people re-enrol their app, the calendar is
 * reconnected.
 *
 * Format: v1.<iv>.<tag>.<ciphertext>, each base64url. The version is there so
 * the key or cipher can change later without guessing what a row holds.
 */
function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY?.trim();
  const bytes = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (bytes.length !== 32) {
    throw new Error(
      'APP_ENCRYPTION_KEY must be 32 bytes, base64. Generate one with: ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return bytes;
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
}

/** Throws if the value was altered or sealed with another key. */
export function open(sealed: string): string {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || data === undefined) throw new Error('Not a sealed value');
  // A short tag would be checked as far as it goes, so only a full one is accepted.
  const authTag = Buffer.from(tag, 'base64url');
  if (authTag.length !== 16) throw new Error('Not a sealed value');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'), { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
