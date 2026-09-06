import { getDb } from '@/db';
import {
  emptyBugs,
  saveBugEntry,
  validateBugEntry,
  type BugLibrary,
} from '@/lib/bugs';
import {
  authorize,
  json,
  failure,
  body,
  ApiError,
  writeLibrary,
} from '@/lib/server';

export const dynamic = 'force-dynamic';
async function readBugs(): Promise<BugLibrary> {
  const row = await getDb()
    .prepare("SELECT items_json,revision FROM libraries WHERE kind='bugs'")
    .first<{ items_json: string; revision: number }>();
  return row
    ? { items: JSON.parse(row.items_json), revision: row.revision }
    : emptyBugs;
}
export async function GET() {
  try {
    return json(await readBugs());
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: Request) {
  try {
    const grant = await authorize(req);
    const input = await body(req);
    if (
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    )
      throw new ApiError(400, 'BUG 记录版本编号无效');
    let entry;
    try {
      entry = validateBugEntry(input.entry);
    } catch (error) {
      throw new ApiError(400, (error as Error).message);
    }
    const current = await readBugs();
    const conflict = () =>
      new ApiError(
        409,
        'BUG 记录已被其他成员更新。你的输入仍保留，请先复制内容，再重新打开后合并修改。',
      );
    if (current.revision !== input.expectedRevision) throw conflict();
    let items;
    try {
      items = saveBugEntry(current.items, entry, new Date().toISOString());
    } catch (error) {
      throw new ApiError(400, (error as Error).message);
    }
    const result = await writeLibrary(
      'bugs',
      JSON.stringify(items),
      current.revision,
      grant,
    );
    if (!result.meta.changes) throw conflict();
    return json({ items, revision: current.revision + 1 });
  } catch (error) {
    return failure(error);
  }
}
