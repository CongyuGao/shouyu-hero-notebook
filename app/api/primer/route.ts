import { getDb } from '@/db';
import { initialPrimer, validatePrimer } from '@/lib/primer';
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
      .prepare("SELECT items_json,revision FROM libraries WHERE kind='primer'")
      .first<{ items_json: string; revision: number }>();
    return json(
      row
        ? { ...JSON.parse(row.items_json), revision: row.revision }
        : initialPrimer,
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const { linkRevision } = await authorize(req);
    const input = await body(req);
    if (
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    )
      throw new ApiError(400, '前瞻版本编号无效');
    let primer;
    try {
      primer = validatePrimer(input);
    } catch (e) {
      throw new ApiError(400, (e as Error).message);
    }
    const result = await writeLibrary(
      'primer',
      JSON.stringify(primer),
      input.expectedRevision,
      linkRevision,
    );
    if (!result.meta.changes)
      throw new ApiError(
        409,
        '前瞻已被其他成员更新。请保留当前输入，关闭后重新读取再合并修改。',
      );
    return json({ ...primer, revision: input.expectedRevision + 1 });
  } catch (e) {
    return failure(e);
  }
}
