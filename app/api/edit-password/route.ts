import { getDb } from '@/db';
import {
  authorize,
  body,
  json,
  failure,
  ApiError,
  ADMIN_WRITE_GUARD,
  adminWriteBindings,
} from '@/lib/server';
import { isCloudflareDeployment } from '@/lib/deployment';
import { matchesOwnerPassword } from '@/lib/owner-password';
import { newEditKey } from '@/lib/edit-link';
import {
  derivePassword,
  passwordStatus,
  readEditPassword,
  validPassword,
} from '@/lib/edit-password';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await authorize(req, true);
    return json(passwordStatus(await readEditPassword()));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const grant = await authorize(req, true);
    const input = await body(req);
    if (
      !['set', 'disable'].includes(input.action) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    )
      throw new ApiError(400, '密码设置无效');
    if (input.action === 'set' && !validPassword(input.password))
      throw new ApiError(
        400,
        '密码请设置为 12–128 个字符，建议使用不易猜到的长密码',
      );
    if (
      input.action === 'set' &&
      isCloudflareDeployment &&
      (await matchesOwnerPassword(input.password))
    )
      throw new ApiError(400, '编辑密码不能与站长密码相同，请分开设置');
    const previous = await readEditPassword();
    if ((previous?.revision || 0) !== input.expectedRevision)
      throw new ApiError(409, '密码设置已在另一处更新，请刷新后再操作');
    if (input.action === 'disable' && !previous?.password_hash)
      throw new ApiError(400, '尚未启用编辑密码');
    const salt = input.action === 'set' ? newEditKey() : null;
    const hash = salt ? await derivePassword(input.password, salt) : null;
    const now = new Date().toISOString(),
      mutation = crypto.randomUUID();
    const db = getDb();
    const save = previous
      ? db
          .prepare(
            `UPDATE edit_password SET password_hash=?,salt=?,revision=revision+1,updated_at=?,mutation_id=? WHERE id='main' AND revision=? AND ${ADMIN_WRITE_GUARD}`,
          )
          .bind(
            hash,
            salt,
            now,
            mutation,
            input.expectedRevision,
            ...adminWriteBindings(grant),
          )
      : db
          .prepare(
            `INSERT OR IGNORE INTO edit_password (id,password_hash,salt,revision,updated_at,mutation_id) SELECT 'main',?,?,1,?,? WHERE ${ADMIN_WRITE_GUARD}`,
          )
          .bind(hash, salt, now, mutation, ...adminWriteBindings(grant));
    // All revocations are conditional on this exact successful CAS and atomic
    // with the password change. A stale settings tab cannot revoke newer grants.
    const changed =
      "EXISTS (SELECT 1 FROM edit_password WHERE id='main' AND mutation_id=?)";
    const result = await db.batch([
      save,
      db
        .prepare(
          `UPDATE edit_links SET token_hash=NULL,revision=revision+1,expires_at=?,updated_at=? WHERE id='main' AND ${changed}`,
        )
        .bind(now, now, mutation),
      db.prepare(`DELETE FROM edit_sessions WHERE ${changed}`).bind(mutation),
      db
        .prepare(`DELETE FROM edit_attempts WHERE id='main' AND ${changed}`)
        .bind(mutation),
    ]);
    if (!result[0].meta.changes)
      throw new ApiError(409, '密码设置已在另一处更新，请刷新后再操作');
    return json({
      enabled: !!hash,
      revision: input.expectedRevision + 1,
      updatedAt: now,
    });
  } catch (e) {
    return failure(e);
  }
}
