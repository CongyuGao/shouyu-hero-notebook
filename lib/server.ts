import { getChatGPTUser } from '@/app/chatgpt-auth';
import { adminEmail, getDb } from '@/db';
import type { Access, GuideRecord, Guide } from './guide';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function identity() {
  const user = await getChatGPTUser();
  const email = user?.email.toLowerCase().trim() || '';
  const isAdmin = !!email && !!adminEmail() && email === adminEmail();
  const allowed =
    isAdmin ||
    !!(
      email &&
      (await getDb()
        .prepare('SELECT email FROM editors WHERE email = ?')
        .bind(email)
        .first())
    );
  const access: Access = {
    signedIn: !!user,
    canEdit: !!allowed,
    isAdmin,
    displayName: user?.displayName || '',
  };
  return { access, email };
}
export async function authorize(req: Request, admin = false) {
  const origin = req.headers.get('origin');
  const url = new URL(req.url);
  if (
    origin &&
    origin !== url.origin &&
    origin !== 'https://shouyu-hero-notebook.abuzz-krill-6860.chatgpt.site'
  )
    throw new ApiError(403, '请求来源不受信任');
  if (req.headers.get('sec-fetch-site') === 'cross-site')
    throw new ApiError(403, '请在本站编辑');
  const i = await identity();
  if (!i.access.signedIn) throw new ApiError(401, '请先登录编辑账号');
  if (!i.access.canEdit || (admin && !i.access.isAdmin))
    throw new ApiError(
      403,
      admin ? '仅管理员可以管理成员' : '你的账号尚未获得编辑权限',
    );
  return i;
}
type Row = {
  hero_id: string;
  draft_json: string;
  published_json: string | null;
  revision: number;
  updated_at: string;
  published_at: string | null;
};
export function toRecord(r: Row, editor: boolean): GuideRecord {
  return {
    heroId: r.hero_id,
    revision: editor ? r.revision : 0,
    updatedAt: editor ? r.updated_at : r.published_at || '',
    publishedAt: r.published_at,
    published: r.published_json
      ? (JSON.parse(r.published_json) as Guide)
      : null,
    ...(editor ? { draft: JSON.parse(r.draft_json) as Guide } : {}),
  };
}
export async function listGuides(editor: boolean) {
  const rows = await getDb()
    .prepare(
      editor
        ? 'SELECT hero_id, draft_json, published_json, revision, updated_at, published_at FROM guides ORDER BY updated_at DESC'
        : 'SELECT hero_id, published_json, published_at FROM guides WHERE published_json IS NOT NULL ORDER BY published_at DESC',
    )
    .all<Row>();
  return rows.results.map((r) => toRecord(r, editor));
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function failure(e: unknown) {
  if (e instanceof ApiError) return json({ error: e.message }, e.status);
  console.error('API failure', e);
  return json(
    { error: '服务暂时不可用，请稍后重试。未保存的内容请先保留。' },
    500,
  );
}
export async function body(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > 180000)
    throw new ApiError(413, '攻略内容过大');
  const t = await req.text();
  if (t.length > 180000) throw new ApiError(413, '攻略内容过大');
  try {
    const parsed = JSON.parse(t);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('object required');
    return parsed;
  } catch {
    throw new ApiError(400, '无法读取提交内容');
  }
}
