import { getDb } from '@/db';
import { authorize, json, failure, body, ApiError } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await authorize(req, true);
    return json(
      (
        await getDb()
          .prepare(
            'SELECT email, created_at AS createdAt FROM editors ORDER BY created_at',
          )
          .all()
      ).results,
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const i = await authorize(req, true),
      data = await body(req);
    if (
      typeof data.email !== 'string' ||
      data.email.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(data.email)
    )
      throw new ApiError(400, '请填写有效邮箱');
    const email = data.email.toLowerCase().trim();
    if (email === i.email)
      throw new ApiError(400, '管理员始终保留权限，无需添加');
    if (!['add', 'remove'].includes(data.action))
      throw new ApiError(400, '无效操作');
    await (
      data.action === 'add'
        ? getDb()
            .prepare(
              'INSERT OR IGNORE INTO editors (email,created_at) VALUES (?,?)',
            )
            .bind(email, new Date().toISOString())
        : getDb().prepare('DELETE FROM editors WHERE email = ?').bind(email)
    ).run();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
