import {
  assertSameOrigin,
  body,
  identity,
  json,
  failure,
  ApiError,
} from '@/lib/server';
import { editCookie, verifyEditKey } from '@/lib/edit-link';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { access } = await identity();
    return json({ active: access.canEdit && !access.isAdmin });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const input = await body(req);
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
    const response = json({ ok: true });
    response.headers.set('Set-Cookie', editCookie('', req.url, 0));
    return response;
  } catch (e) {
    return failure(e);
  }
}
