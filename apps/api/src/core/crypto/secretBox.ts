import crypto from 'crypto';
import { AppError } from '../errors/AppError';

// ── Secret box (AES-256-GCM) ──────────────────────────────────────────────
//
// Shared symmetric encryption for at-rest secrets (integration API keys, AI
// provider keys, …). ENCRYPTION_KEY must be a 64-char hex string (32 bytes)
// in the environment.
//   Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// `encryptSecret` returns a self-describing JSON envelope (iv + auth tag +
// ciphertext, all hex) that `decryptSecret` reverses. Callers store the
// envelope string verbatim and never see plaintext keys after save.

const ALGORITHM = 'aes-256-gcm' as const;

export interface EncryptedEnvelope {
  iv: string;         // hex
  tag: string;        // hex — GCM auth tag
  ciphertext: string; // hex
}

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new AppError(500, 'ENCRYPTION_KEY env var is missing or invalid (must be 64-char hex)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: EncryptedEnvelope = {
    iv:         iv.toString('hex'),
    tag:        tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
  return JSON.stringify(envelope);
}

export function decryptSecret(envelopeJson: string): string {
  const key = getEncryptionKey();
  const { iv, tag, ciphertext } = JSON.parse(envelopeJson) as EncryptedEnvelope;
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(Buffer.from(ciphertext, 'hex')) + decipher.final('utf8');
}
