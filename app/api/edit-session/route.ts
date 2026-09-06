import {
  assertSameOrigin,
  body,
  identity,
  json,
  failure,
  ApiError,
} from '@/lib/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import {
  EDIT_COOKIE,
  editCookie,
  verifyEditKey,
  hashEditKey,
} from '@/lib/edit-link';
import {
  readEditPassword,
  reservePasswordAttempt,
  validPassword,
  derivePassword,
  sameHash,
  createPasswordSession,
  PASSWORD_SESSION_SECONDS,
  PASSWORD_WINDOW_MS,
} from '@/lib/edit-password';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { access } = await identity();
    const password = await readEditPassword();
    return json({
      active: access.canEdit && !access.isAdmin,
      passwordEnabled: !!password?.password_hash,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const input = await body(req);
    if ('password' in input) {
      if (!validPassword(input.password))
        throw new ApiError(401, '密码不正确或已更改，请向站点所有者确认');
      const password = await readEditPassword();
      if (!password?.password_hash || !password.salt)
        throw new ApiError(401, '暂未启用密码编辑，请联系站点所有者');
      if (!(await reservePasswordAttempt())) {
        const response = json(
          {
            error:
              '短时间内验证次数过多，请 5 分钟后重试。站点所有者仍可进入管理页面。',
          },
          429,
        );
        response.headers.set('Retry-After', String(PASSWORD_WINDOW_MS / 1000));
        return response;
      }
      const hash = await derivePassword(input.password, password.salt);
      if (!sameHash(hash, password.password_hash))
        throw new ApiError(401, '密码不正确或已更改，请向站点所有者确认');
      const key = await createPasswordSession(password.revision);
      if (!key) throw new ApiError(401, '密码刚刚被更改，请使用新密码重新验证');
      const response = json({ ok: true });
      response.headers.set(
        'Set-Cookie',
        editCookie(key, req.url, PASSWORD_SESSION_SECONDS),
      );
      return response;
    }
    const link = await verifyEditKey(input.key);
    if (!link)
      throw new ApiError(
        401,
        '编辑链接无效、已过期或已作废，请向站点所有者获取新链接。',
      );
    const response = json({ ok: true });
    const seconds = Math.max(
      1,
      Math.min(
        604800,
        Math.floor((Date.parse(link.expires_at) - Date.now()) / 1000),
      ),
    );
    response.headers.set('Set-Cookie', editCookie(input.key, req.url, seconds));
    return response;
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const key = (await cookies()).get(EDIT_COOKIE)?.value;
    if (key?.startsWith('p.'))
      await getDb()
        .prepare('DELETE FROM edit_sessions WHERE token_hash=?')
        .bind(await hashEditKey(key))
        .run();
    const response = json({ ok: true });
    response.headers.set('Set-Cookie', editCookie('', req.url, 0));
    return response;
  } catch (e) {
    return failure(e);
  }
}
