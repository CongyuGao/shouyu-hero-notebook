import { getDb } from '@/db';
import { validateGuide } from '@/lib/guide';
import {
  identity,
  authorize,
  listGuides,
  json,
  failure,
  body,
  ApiError,
} from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { access } = await identity();
    return json({ access, guides: await listGuides(access.canEdit) });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const { email } = await authorize(req);
    const input = await body(req);
    if (!['draft', 'publish', 'unpublish'].includes(input.action))
      throw new ApiError(400, '未知保存操作');
    if (
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    )
      throw new ApiError(400, '版本编号无效');
    let doc;
    try {
      doc = validateGuide(input.doc, input.action === 'publish');
    } catch (e) {
      throw new ApiError(400, (e as Error).message);
    }
    const db = getDb(),
      now = new Date().toISOString(),
      mutation = crypto.randomUUID(),
      serialized = JSON.stringify(doc),
      pub = input.action === 'publish' ? serialized : null;
    const save =
      input.expectedRevision === 0
        ? db
            .prepare(
              'INSERT OR IGNORE INTO guides (hero_id, draft_json, published_json, revision, updated_at, published_at, updated_by, mutation_id) VALUES (?, ?, ?, 1, ?, ?, ?, ?)',
            )
            .bind(
              doc.heroId,
              serialized,
              pub,
              now,
              pub ? now : null,
              email,
              mutation,
            )
        : db
            .prepare(
              "UPDATE guides SET draft_json = ?, published_json = CASE WHEN ? = 'publish' THEN ? WHEN ? = 'unpublish' THEN NULL ELSE published_json END, published_at = CASE WHEN ? = 'publish' THEN ? WHEN ? = 'unpublish' THEN NULL ELSE published_at END, revision = revision + 1, updated_at = ?, updated_by = ?, mutation_id = ? WHERE hero_id = ? AND revision = ?",
            )
            .bind(
              serialized,
              input.action,
              serialized,
              input.action,
              input.action,
              now,
              input.action,
              now,
              email,
              mutation,
              doc.heroId,
              input.expectedRevision,
            );
    const audit = db
      .prepare(
        'INSERT INTO revisions (hero_id,revision,snapshot,action,created_at,author) SELECT hero_id,revision,draft_json,?,updated_at,updated_by FROM guides WHERE hero_id = ? AND mutation_id = ?',
      )
      .bind(input.action, doc.heroId, mutation);
    const readSaved = db
      .prepare(
        'SELECT revision, updated_at AS updatedAt, published_at AS publishedAt FROM guides WHERE hero_id = ? AND mutation_id = ?',
      )
      .bind(doc.heroId, mutation);
    const result = await db.batch([save, audit, readSaved]);
    if (!result[0].meta.changes)
      throw new ApiError(
        409,
        '这篇攻略已被其他成员更新。请先导出当前内容，再关闭编辑并刷新后合并修改。',
      );
    const saved = result[2].results[0] as {
      revision: number;
      updatedAt: string;
      publishedAt: string | null;
    };
    return json({ ok: true, ...saved });
  } catch (e) {
    return failure(e);
  }
}
