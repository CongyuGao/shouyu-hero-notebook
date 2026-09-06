import { getDb } from '@/db';
import { authorize, json, failure } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await authorize(req);
    const heroId = new URL(req.url).searchParams.get('heroId') || '';
    return json(
      (
        await getDb()
          .prepare(
            'SELECT revision,snapshot,action,created_at AS createdAt FROM revisions WHERE hero_id = ? ORDER BY revision DESC LIMIT 20',
          )
          .bind(heroId)
          .all()
      ).results,
    );
  } catch (e) {
    return failure(e);
  }
}
