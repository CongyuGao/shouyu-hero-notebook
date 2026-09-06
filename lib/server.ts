import { getChatGPTUser } from '@/app/chatgpt-auth';
import { adminEmail, getDb } from '@/db';
import { cookies, headers } from 'next/headers';
import { EDIT_COOKIE, verifyEditKey } from './edit-link';
import { verifyPasswordSession } from './edit-password';
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
    passwordSessionHash: null as string | null,
  };
  // A normal reading URL must remain public-only, even in an editor's browser.
  if (mode !== 'manage' && mode !== 'edit') return anonymous;
  if (mode === 'edit') {
    const key = (await cookies()).get(EDIT_COOKIE)?.value;
    const session = await verifyPasswordSession(key);
    if (session)
      return {
        access: {
          signedIn: true,
          canEdit: true,
          isAdmin: false,
          displayName: '密码编辑者',
        },
        email: `密码编辑 #${session.revision}`,
        linkRevision: null as number | null,
        passwordSessionHash: session.tokenHash as string | null,
      };
    const link = await verifyEditKey(key);
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
          passwordSessionHash: null as string | null,
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
  return {
    access,
    email,
    linkRevision: null as number | null,
    passwordSessionHash: null as string | null,
  };
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
      '编辑权限已失效。请先保留未保存内容，再使用新密码或有效编辑链接重新验证。',
    );
  if (!i.access.canEdit || (admin && !i.access.isAdmin))
    throw new ApiError(
      403,
      admin
        ? '只有站点所有者可以修改密码和分享权限'
        : '请先验证编辑密码或使用有效编辑链接',
    );
  return i;
}
// Re-check the capability inside each actual write, so expiry/revocation wins
// even when it happens after the request's initial authorization check.
export const EDIT_WRITE_GUARD = `(?=1
    OR EXISTS (SELECT 1 FROM edit_links WHERE id='main' AND token_hash IS NOT NULL AND revision=? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    OR EXISTS (SELECT 1 FROM edit_sessions s JOIN edit_password p ON p.id='main' WHERE s.token_hash=? AND s.password_revision=p.revision AND p.password_hash IS NOT NULL AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')))`;
type WriteGrant = Awaited<ReturnType<typeof authorize>>;
export function editWriteBindings(grant: WriteGrant) {
  return [
    grant.access.isAdmin ? 1 : 0,
    grant.linkRevision,
    grant.passwordSessionHash,
  ];
}
export async function writeLibrary(
  kind: string,
  serialized: string,
  revision: number,
  grant: WriteGrant,
) {
  const now = new Date().toISOString();
  return revision === 0
    ? getDb()
        .prepare(
          `INSERT OR IGNORE INTO libraries (kind,items_json,revision,updated_at) SELECT ?,?,1,? WHERE ${EDIT_WRITE_GUARD}`,
        )
        .bind(kind, serialized, now, ...editWriteBindings(grant))
        .run()
    : getDb()
        .prepare(
          `UPDATE libraries SET items_json=?,revision=revision+1,updated_at=? WHERE kind=? AND revision=? AND ${EDIT_WRITE_GUARD}`,
        )
        .bind(serialized, now, kind, revision, ...editWriteBindings(grant))
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
    ...(editor
      ? {
          draft: JSON.parse(r.draft_json) as Guide,
          pendingDraft:
            !r.published_json ||
            r.draft_json !== r.published_json ||
            r.updated_at > (r.published_at || ''),
        }
      : {}),
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
