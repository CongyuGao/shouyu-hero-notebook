import { getDb, adminEmail } from '@/db';
import { cookies } from 'next/headers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { isCloudflareDeployment } from './deployment';
import { derivePassword, sameHash, validPassword } from './edit-password';
import { hashEditKey, newEditKey, validKeyFormat } from './edit-link';

export const OWNER_COOKIE = isCloudflareDeployment
  ? '__Host-shouyu_owner'
  : 'shouyu_owner_session';
export const OWNER_SESSION_SECONDS = 12 * 60 * 60;
export type OwnerPasswordRow = {
  password_hash: string;
  salt: string;
  revision: number;
  updated_at: string;
};
export async function readOwnerPassword() {
  return getDb()
    .prepare(
      "SELECT password_hash,salt,revision,updated_at FROM owner_password WHERE id='main'",
    )
    .first<OwnerPasswordRow>();
}
export function validOwnerPassword(value: unknown): value is string {
  return validPassword(value) && value.trim().length >= 20;
}
export async function matchesOwnerPassword(password: string) {
  const row = await readOwnerPassword();
  return (
    !!row &&
    sameHash(await derivePassword(password, row.salt), row.password_hash)
  );
}
export function ownerCookie(
  value: string,
  requestUrl: string,
  seconds: number,
) {
  return `${OWNER_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${isCloudflareDeployment || new URL(requestUrl).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function createOwnerSession(revision: number) {
  const key = `o.${newEditKey()}`,
    hash = await hashEditKey(key);
  const now = new Date().toISOString();
  const expires = new Date(
    Date.now() + OWNER_SESSION_SECONDS * 1000,
  ).toISOString();
  const db = getDb();
  const results = await db.batch([
    db.prepare('DELETE FROM owner_sessions WHERE expires_at<=?').bind(now),
    db
      .prepare(
        "INSERT INTO owner_sessions(token_hash,password_revision,expires_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM owner_password WHERE id='main' AND revision=?)",
      )
      .bind(hash, revision, expires, revision),
  ]);
  return results[1].meta.changes ? key : null;
}
export async function verifyOwnerSession(key: unknown) {
  if (
    typeof key !== 'string' ||
    !key.startsWith('o.') ||
    !validKeyFormat(key.slice(2))
  )
    return null;
  const hash = await hashEditKey(key);
  const row = await getDb()
    .prepare(`SELECT s.password_revision FROM owner_sessions s JOIN owner_password p ON p.id='main'
    WHERE s.token_hash=? AND s.password_revision=p.revision AND s.expires_at>?`)
    .bind(hash, new Date().toISOString())
    .first<{ password_revision: number }>();
  return row ? { tokenHash: hash, revision: row.password_revision } : null;
}
export async function getOwnerUser() {
  // A direct Workers deployment has no Sites identity dispatcher. Never trust
  // oai-authenticated-user-* or a client-supplied email in this target.
  if (!isCloudflareDeployment) {
    const user = await getChatGPTUser();
    return user ? { ...user, ownerSessionHash: null as string | null } : null;
  }
  const session = await verifyOwnerSession(
    (await cookies()).get(OWNER_COOKIE)?.value,
  );
  if (!session || !adminEmail()) return null;
  return {
    userId: 'owner',
    displayName: '漫游的逗号',
    email: adminEmail(),
    fullName: null,
    ownerSessionHash: session.tokenHash as string | null,
  };
}
export const OWNER_WRITE_GUARD = `EXISTS (SELECT 1 FROM owner_sessions os JOIN owner_password op ON op.id='main' WHERE os.token_hash=? AND os.password_revision=op.revision AND os.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
