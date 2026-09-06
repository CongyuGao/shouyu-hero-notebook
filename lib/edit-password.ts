import { getDb } from '@/db';
import { hashEditKey, newEditKey, validKeyFormat } from './edit-link';

export const PASSWORD_SESSION_SECONDS = 12 * 60 * 60;
export const PASSWORD_WINDOW_MS = 5 * 60 * 1000;
export const PASSWORD_ATTEMPT_LIMIT = 10;
// Current workerd defaults cap each native derivation at 100,000 iterations.
const ITERATIONS = 100_000;
type PasswordRow = {
  password_hash: string | null;
  salt: string | null;
  revision: number;
  updated_at: string;
};
export async function readEditPassword() {
  return getDb()
    .prepare(
      "SELECT password_hash,salt,revision,updated_at FROM edit_password WHERE id='main'",
    )
    .first<PasswordRow>();
}
export function passwordStatus(row: PasswordRow | null) {
  return {
    enabled: !!row?.password_hash,
    revision: row?.revision || 0,
    updatedAt: row?.updated_at || null,
  };
}
export function validPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 12 &&
    value.length <= 128 &&
    value.trim().length >= 12
  );
}
export async function derivePassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const result = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-512',
      salt: new TextEncoder().encode(salt),
      iterations: ITERATIONS,
    },
    key,
    256,
  );
  return (
    `pbkdf2-sha512:${ITERATIONS}:` +
    Array.from(new Uint8Array(result), (v) =>
      v.toString(16).padStart(2, '0'),
    ).join('')
  );
}
export function sameHash(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a),
    right = encoder.encode(b);
  if (left.length !== right.length) return false;
  return (
    crypto.subtle as SubtleCrypto & {
      timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
    }
  ).timingSafeEqual(left, right);
}
// A durable, site-wide ceiling avoids relying on spoofable forwarded IPs.
// Reserve before doing the expensive KDF; parallel requests cannot exceed it.
export async function reservePasswordAttempt() {
  const now = Date.now();
  const result = await getDb()
    .prepare(
      `INSERT INTO edit_attempts (id,window_start,attempts) VALUES ('main',?,1)
     ON CONFLICT(id) DO UPDATE SET
       window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END,
       attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END
     WHERE window_start<=? OR attempts<?
     RETURNING attempts`,
    )
    .bind(
      now,
      now - PASSWORD_WINDOW_MS,
      now - PASSWORD_WINDOW_MS,
      now - PASSWORD_WINDOW_MS,
      PASSWORD_ATTEMPT_LIMIT,
    )
    .first();
  return !!result;
}
export async function createPasswordSession(revision: number) {
  const key = `p.${newEditKey()}`;
  const tokenHash = await hashEditKey(key);
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + PASSWORD_SESSION_SECONDS * 1000,
  ).toISOString();
  const results = await getDb().batch([
    getDb().prepare('DELETE FROM edit_sessions WHERE expires_at<=?').bind(now),
    getDb()
      .prepare(
        `INSERT INTO edit_sessions (token_hash,password_revision,expires_at)
       SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM edit_password WHERE id='main' AND revision=? AND password_hash IS NOT NULL)`,
      )
      .bind(tokenHash, revision, expiresAt, revision),
  ]);
  return results[1].meta.changes ? key : null;
}
export async function verifyPasswordSession(key: unknown) {
  if (
    typeof key !== 'string' ||
    !key.startsWith('p.') ||
    !validKeyFormat(key.slice(2))
  )
    return null;
  const tokenHash = await hashEditKey(key);
  const session = await getDb()
    .prepare(
      `SELECT s.password_revision FROM edit_sessions s JOIN edit_password p ON p.id='main'
     WHERE s.token_hash=? AND s.password_revision=p.revision AND p.password_hash IS NOT NULL AND s.expires_at>?`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first<{ password_revision: number }>();
  return session ? { tokenHash, revision: session.password_revision } : null;
}
