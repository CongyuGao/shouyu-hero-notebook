import { getDb } from '@/db';
import initial from '@/data/initial-library.json';
import {
  validateCatalog,
  validateRuneColors,
  type CatalogKind,
} from '@/lib/catalog';
import { authorize, json, failure, body, ApiError } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const data: Record<string, unknown> = {};
    for (const kind of ['glyphs', 'runes'] as const) {
      const row = await getDb()
        .prepare('SELECT items_json,revision FROM libraries WHERE kind=?')
        .bind(kind)
        .first<{ items_json: string; revision: number }>();
      data[kind] = {
        kind,
        revision: row?.revision || 0,
        items: row
          ? JSON.parse(row.items_json)
          : validateCatalog(initial[kind]),
      };
    }
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await authorize(req);
    const input = await body(req);
    if (
      !['glyphs', 'runes'].includes(input.kind) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    )
      throw new ApiError(400, '资料库或版本编号不正确');
    let items;
    try {
      items = validateCatalog(input.items);
      if (input.kind === 'runes') validateRuneColors(items);
    } catch (e) {
      throw new ApiError(400, (e as Error).message);
    }
    const kind = input.kind as CatalogKind,
      db = getDb(),
      now = new Date().toISOString();
    const result = await (
      input.expectedRevision === 0
        ? db
            .prepare(
              'INSERT OR IGNORE INTO libraries (kind,items_json,revision,updated_at) VALUES (?,?,1,?)',
            )
            .bind(kind, JSON.stringify(items), now)
        : db
            .prepare(
              'UPDATE libraries SET items_json=?,revision=revision+1,updated_at=? WHERE kind=? AND revision=?',
            )
            .bind(JSON.stringify(items), now, kind, input.expectedRevision)
    ).run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        '资料库已被其他成员更新，请刷新资料库后再修改。当前输入仍保留。',
      );
    return json({ kind, items, revision: input.expectedRevision + 1 });
  } catch (e) {
    return failure(e);
  }
}
