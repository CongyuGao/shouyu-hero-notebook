import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { isCloudflareDeployment } from '@/lib/deployment';
import { assertSameOrigin, body, json, failure, ApiError } from '@/lib/server';
import {
  derivePassword,
  sameHash,
  reservePasswordAttempt,
} from '@/lib/edit-password';
import { hashEditKey } from '@/lib/edit-link';
import {
  readOwnerPassword,
  verifyOwnerSession,
  createOwnerSession,
  validOwnerPassword,
  ownerCookie,
  OWNER_COOKIE,
  OWNER_SESSION_SECONDS,
} from '@/lib/owner-password';
export const dynamic = 'force-dynamic';
function enabled() {
  if (!isCloudflareDeployment) throw new ApiError(404, '此入口仅用于独立部署');
}
export async function GET() {
  try {
    enabled();
    const session = await verifyOwnerSession(
      (await cookies()).get(OWNER_COOKIE)?.value,
    );
    return json({
      active: !!session,
      configured: !!(await readOwnerPassword()),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    enabled();
    assertSameOrigin(req);
    const input = await body(req);
    if (!validOwnerPassword(input.password))
      throw new ApiError(401, '站长密码不正确');
    if (!(await reservePasswordAttempt('owner'))) {
      const r = json({ error: '站长验证次数过多，请 5 分钟后重试。' }, 429);
      r.headers.set('Retry-After', '300');
      return r;
    }
    const row = await readOwnerPassword();
    if (
      !row ||
      !sameHash(
        await derivePassword(input.password, row.salt),
        row.password_hash,
      )
    )
      throw new ApiError(401, '站长密码不正确');
    const key = await createOwnerSession(row.revision);
    if (!key) throw new ApiError(401, '站长密码刚刚更新，请重新验证');
    const response = json({ ok: true });
    response.headers.set(
      'Set-Cookie',
      ownerCookie(key, req.url, OWNER_SESSION_SECONDS),
    );
    return response;
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    enabled();
    assertSameOrigin(req);
    const key = (await cookies()).get(OWNER_COOKIE)?.value;
    if (key)
      await getDb()
        .prepare('DELETE FROM owner_sessions WHERE token_hash=?')
        .bind(await hashEditKey(key))
        .run();
    const response = json({ ok: true });
    response.headers.set('Set-Cookie', ownerCookie('', req.url, 0));
    return response;
  } catch (e) {
    return failure(e);
  }
}
