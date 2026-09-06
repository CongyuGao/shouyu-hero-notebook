import { getDb } from '@/db';
import { isCloudflareDeployment } from '@/lib/deployment';
import { authorize, body, json, failure, ApiError } from '@/lib/server';
import {
  derivePassword,
  sameHash,
  readEditPassword,
  reservePasswordAttempt,
} from '@/lib/edit-password';
import { newEditKey } from '@/lib/edit-link';
import {
  readOwnerPassword,
  validOwnerPassword,
  ownerCookie,
  OWNER_WRITE_GUARD,
} from '@/lib/owner-password';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    if (!isCloudflareDeployment)
      throw new ApiError(404, '此入口仅用于独立部署');
    const grant = await authorize(req, true);
    const input = await body(req);
    if (
      !validOwnerPassword(input.currentPassword) ||
      !validOwnerPassword(input.password)
    )
      throw new ApiError(
        400,
        '站长密码需为 20–128 个字符，建议使用密码管理器生成的随机密码',
      );
    if (!(await reservePasswordAttempt('owner')))
      throw new ApiError(429, '站长验证次数过多，请 5 分钟后重试');
    const row = await readOwnerPassword();
    if (
      !row ||
      !sameHash(
        await derivePassword(input.currentPassword, row.salt),
        row.password_hash,
      )
    )
      throw new ApiError(401, '当前站长密码不正确');
    if (input.password === input.currentPassword)
      throw new ApiError(400, '新站长密码不能与旧密码相同');
    const shared = await readEditPassword();
    if (
      shared?.password_hash &&
      shared.salt &&
      sameHash(
        await derivePassword(input.password, shared.salt),
        shared.password_hash,
      )
    )
      throw new ApiError(400, '站长密码不能与共享编辑密码相同');
    const salt = newEditKey(),
      hash = await derivePassword(input.password, salt);
    const db = getDb(),
      now = new Date().toISOString();
    const changed =
      "EXISTS (SELECT 1 FROM owner_password WHERE id='main' AND revision=? AND password_hash=?)";
    const result = await db.batch([
      db
        .prepare(
          `UPDATE owner_password SET password_hash=?,salt=?,revision=revision+1,updated_at=? WHERE id='main' AND revision=? AND ${OWNER_WRITE_GUARD}`,
        )
        .bind(hash, salt, now, row.revision, grant.ownerSessionHash),
      db
        .prepare(
          "DELETE FROM owner_sessions WHERE EXISTS (SELECT 1 FROM owner_password WHERE id='main' AND revision=? AND password_hash=?)",
        )
        .bind(row.revision + 1, hash),
      db
        .prepare(
          `UPDATE edit_password SET password_hash=NULL,salt=NULL,revision=revision+1,updated_at=?,mutation_id=? WHERE id='main' AND ${changed}`,
        )
        .bind(now, crypto.randomUUID(), row.revision + 1, hash),
      db
        .prepare(
          `UPDATE edit_links SET token_hash=NULL,revision=revision+1,expires_at=?,updated_at=? WHERE id='main' AND ${changed}`,
        )
        .bind(now, now, row.revision + 1, hash),
      db
        .prepare(`DELETE FROM edit_sessions WHERE ${changed}`)
        .bind(row.revision + 1, hash),
    ]);
    if (!result[0].meta.changes)
      throw new ApiError(409, '站长权限已变化，请重新登录后操作');
    const response = json({ ok: true });
    response.headers.set('Set-Cookie', ownerCookie('', req.url, 0));
    return response;
  } catch (e) {
    return failure(e);
  }
}
