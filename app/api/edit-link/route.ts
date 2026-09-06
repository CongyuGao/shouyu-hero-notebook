import { getDb } from '@/db';
import { authorize, body, json, failure, ApiError } from '@/lib/server';
import {
  readEditLink,
  newEditKey,
  hashEditKey,
  LINK_DURATIONS,
} from '@/lib/edit-link';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await authorize(req, true);
    const link = await readEditLink();
    return json({
      enabled: !!link?.token_hash && link.expires_at > new Date().toISOString(),
      revision: link?.revision || 0,
      expiresAt: link?.expires_at || null,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await authorize(req, true);
    const input = await body(req);
    if (
      !['create', 'rotate', 'revoke'].includes(input.action) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    )
      throw new ApiError(400, '链接操作无效');
    const previous = await readEditLink();
    if ((previous?.revision || 0) !== input.expectedRevision)
      throw new ApiError(409, '链接已在另一处更新，请刷新后重试');
    if (
      input.action === 'create' &&
      previous?.token_hash &&
      previous.expires_at > new Date().toISOString()
    )
      throw new ApiError(409, '已有有效编辑链接，请使用重置操作');
    if (input.action !== 'revoke' && !LINK_DURATIONS.includes(input.hours))
      throw new ApiError(400, '请选择有效期');
    if (input.action === 'revoke' && !previous)
      throw new ApiError(400, '尚未生成编辑链接');
    const key = input.action === 'revoke' ? null : newEditKey();
    const hash = key ? await hashEditKey(key) : null;
    const now = new Date().toISOString();
    const expiresAt = key
      ? new Date(Date.now() + input.hours * 3600000).toISOString()
      : now;
    const result = previous
      ? await getDb()
          .prepare(
            'UPDATE edit_links SET token_hash = ?, expires_at = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?',
          )
          .bind(hash, expiresAt, now, 'main', input.expectedRevision)
          .run()
      : await getDb()
          .prepare(
            'INSERT OR IGNORE INTO edit_links (id, token_hash, revision, expires_at, updated_at) VALUES (?, ?, 1, ?, ?)',
          )
          .bind('main', hash, expiresAt, now)
          .run();
    if (!result.meta.changes)
      throw new ApiError(409, '链接已在另一处更新，请刷新后重试');
    // The raw key is returned once. Never persist it, put it in logs, or expose it in GET.
    return json({
      key,
      enabled: !!key,
      revision: input.expectedRevision + 1,
      expiresAt,
    });
  } catch (e) {
    return failure(e);
  }
}
