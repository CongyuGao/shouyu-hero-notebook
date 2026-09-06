import { getDb } from '@/db';
import { defaultTierSettings, validateTierSettings } from '@/lib/tiers';
import { authorize, json, failure, body, ApiError } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const row = await getDb()
      .prepare("SELECT items_json,revision FROM libraries WHERE kind='tiers'")
      .first<{ items_json: string; revision: number }>();
    return json(
      row
        ? { ...JSON.parse(row.items_json), revision: row.revision }
        : defaultTierSettings,
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    await authorize(req);
    const input = await body(req);
    if (
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    )
      throw new ApiError(400, '评级标准版本不正确');
    let settings;
    try {
      settings = validateTierSettings(input);
    } catch (e) {
      throw new ApiError(400, (e as Error).message);
    }
    const now = new Date().toISOString(),
      db = getDb();
    const result = await (
      input.expectedRevision === 0
        ? db
            .prepare(
              "INSERT OR IGNORE INTO libraries (kind,items_json,revision,updated_at) VALUES ('tiers',?,1,?)",
            )
            .bind(JSON.stringify(settings), now)
        : db
            .prepare(
              "UPDATE libraries SET items_json=?,revision=revision+1,updated_at=? WHERE kind='tiers' AND revision=?",
            )
            .bind(JSON.stringify(settings), now, input.expectedRevision)
    ).run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        '标准已被其他成员更新，请重新打开后编辑。当前输入仍保留。',
      );
    return json({ ...settings, revision: input.expectedRevision + 1 });
  } catch (e) {
    return failure(e);
  }
}
