import { getDb } from '@/db';
import { initialRoster, validateRoster } from '@/lib/mode-roster';
import {
  authorize,
  json,
  failure,
  body,
  ApiError,
  writeLibrary,
} from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const row = await getDb()
      .prepare("SELECT items_json,revision FROM libraries WHERE kind='roster'")
      .first<{ items_json: string; revision: number }>();
    return json(
      row
        ? { ...JSON.parse(row.items_json), revision: row.revision }
        : initialRoster,
    );
  } catch (e) {
    return failure(e);
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
      throw new ApiError(400, '英雄池版本编号无效');
    let roster;
    try {
      roster = validateRoster(input);
    } catch (e) {
      throw new ApiError(400, (e as Error).message);
    }
    const result = await writeLibrary(
      'roster',
      JSON.stringify(roster),
      input.expectedRevision,
      grant,
    );
    if (!result.meta.changes)
      throw new ApiError(
        409,
        '英雄池已被其他成员更新。当前输入已保留，请重新读取后合并修改。',
      );
    return json({ ...roster, revision: input.expectedRevision + 1 });
  } catch (e) {
    return failure(e);
  }
}
