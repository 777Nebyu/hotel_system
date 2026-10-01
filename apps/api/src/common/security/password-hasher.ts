import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

/**
 * Password hashing policy. Argon2id is the only algorithm used for newly
 * created or changed user passwords. The bcrypt fallback exists solely to
 * migrate existing accounts on their next successful login.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  if (encodedHash.startsWith('$argon2')) {
    return argon2.verify(encodedHash, password);
  }
  // Legacy bcrypt hashes are accepted only for migration. A successful
  // login immediately replaces them with an Argon2id hash.
  return bcrypt.compare(password, encodedHash);
}

export function isLegacyPasswordHash(encodedHash: string): boolean {
  return !encodedHash.startsWith('$argon2');
}
