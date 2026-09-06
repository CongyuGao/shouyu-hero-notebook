import { getDb } from '@/db';

export const EDIT_COOKIE = 'shouyu_edit_key';
export const LINK_DURATIONS = [1, 24, 168, 720] as const;
export type EditLinkRow = {
  token_hash: string | null;
  revision: number;
  expires_at: string;
  updated_at: string;
};
export function newEditKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
}
export function validKeyFormat(key: unknown): key is string {
  return typeof key === 'string' && /^[a-f0-9]{64}$/.test(key);
}
export async function hashEditKey(key: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
    ),
    (v) => v.toString(16).padStart(2, '0'),
  ).join('');
}
export async function readEditLink() {
  return getDb()
    .prepare(
      'SELECT token_hash, revision, expires_at, updated_at FROM edit_links WHERE id = ?',
    )
    .bind('main')
    .first<EditLinkRow>();
}
export async function verifyEditKey(key: unknown) {
  if (!validKeyFormat(key)) return null;
  const hash = await hashEditKey(key);
  // Both expiry and revocation are checked on every authorized request.
  return getDb()
    .prepare(
      'SELECT revision, expires_at FROM edit_links WHERE id = ? AND token_hash = ? AND expires_at > ?',
    )
    .bind('main', hash, new Date().toISOString())
    .first<{ revision: number; expires_at: string }>();
}
export function editCookie(key: string, requestUrl: string, seconds: number) {
  return `${EDIT_COOKIE}=${key}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${seconds}${new URL(requestUrl).protocol === 'https:' ? '; Secure' : ''}`;
}
