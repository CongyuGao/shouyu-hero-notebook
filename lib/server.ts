import { getChatGPTUser } from '@/app/chatgpt-auth';
import { adminEmail, getDb } from '@/db';
import { cookies, headers } from 'next/headers';
import { EDIT_COOKIE, verifyEditKey } from './edit-link';
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
  const mode = (await headers()).get('x-notebook-mode');
  const anonymous = {
    access: {
      signedIn: false,
      canEdit: false,
      isAdmin: false,
      displayName: '',
    },
    email: '',
    linkRevision: null as number | null,
  };
  // A normal reading URL must remain public-only, even in an editor's browser.
  if (mode !== 'manage' && mode !== 'edit') return anonymous;
  if (mode === 'edit') {
    const link = await verifyEditKey((await cookies()).get(EDIT_COOKIE)?.value);
    return link
      ? {
          access: {
            signedIn: true,
            canEdit: true,
            isAdmin: false,
            displayName: '链接编辑者',
          },
          email: `共享编辑链接 #${link.revision}`,
          linkRevision: link.revision as number | null,
        }
      : anonymous;
  }
  const user = await getChatGPTUser();
  const email = user?.email.toLowerCase().trim() || '';
  const isAdmin = !!email && !!adminEmail() && email === adminEmail();
  const access: Access = {
    signedIn: !!user,
    canEdit: isAdmin,
    isAdmin,
    displayName: user?.displayName || '',
  };
  return { access, email, linkRevision: null as number | null };
}
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const url = new URL(req.url);
  if (!origin || origin !== url.origin)
    throw new ApiError(403, '请求来源不受信任');
  if (req.headers.get('sec-fetch-site') === 'cross-site')
    throw new ApiError(403, '请在本站编辑');
  if (
    req.method !== 'DELETE' &&
    !req.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new ApiError(415, '请使用本站编辑入口提交');
}
export async function authorize(req: Request, admin = false) {
  if (!['GET', 'HEAD'].includes(req.method)) assertSameOrigin(req);
  const i = await identity();
  if (!i.access.signedIn)
    throw new ApiError(
      401,
      '编辑链接未启用、已过期或已作废。请保留未保存内容，再获取新的编辑链接。',
    );
  if (!i.access.canEdit || (admin && !i.access.isAdmin))
    throw new ApiError(
      403,
      admin ? '仅站点所有者可以管理编辑链接' : '请使用有效的专属编辑链接',
    );
  return i;
}
// Re-check the capability inside each actual write, so expiry/revocation wins
// even when it happens after the request's initial authorization check.
export const EDIT_WRITE_GUARD =
  "(? IS NULL OR EXISTS (SELECT 1 FROM edit_links WHERE id='main' AND token_hash IS NOT NULL AND revision=? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')))";
export async function writeLibrary(
  kind: string,
  serialized: string,
  revision: number,
  linkRevision: number | null,
) {
  const now = new Date().toISOString();
  return revision === 0
    ? getDb()
        .prepare(
          `INSERT OR IGNORE INTO libraries (kind,items_json,revision,updated_at) SELECT ?,?,1,? WHERE ${EDIT_WRITE_GUARD}`,
        )
        .bind(kind, serialized, now, linkRevision, linkRevision)
        .run()
    : getDb()
        .prepare(
          `UPDATE libraries SET items_json=?,revision=revision+1,updated_at=? WHERE kind=? AND revision=? AND ${EDIT_WRITE_GUARD}`,
        )
        .bind(serialized, now, kind, revision, linkRevision, linkRevision)
        .run();
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
      'Referrer-Policy': 'no-referrer',
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
