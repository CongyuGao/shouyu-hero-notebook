import initialGuides from '@/data/initial-guides.json';
import { getDb } from '@/db';
import { validateGuide } from './guide';

let initialized = false;

// Published local snapshot for first deployment only. Never replace an existing
// guide, including an edited draft or one the owner deliberately unpublished.
export async function ensureInitialGuides() {
  if (initialized) return;
  const db = getDb();
  for (const input of initialGuides) {
    const doc = validateGuide(input, true);
    const snapshot = JSON.stringify(doc);
    const mutation = crypto.randomUUID();
    // Deployment must not make an older guide appear newly updated.
    const publishedAt = input.publishedAt;
    await db.batch([
      db
        .prepare(
          'INSERT OR IGNORE INTO guides (hero_id, draft_json, published_json, revision, updated_at, published_at, updated_by, mutation_id) VALUES (?, ?, ?, 1, ?, ?, ?, ?)',
        )
        .bind(
          doc.heroId,
          snapshot,
          snapshot,
          publishedAt,
          publishedAt,
          'published-snapshot',
          mutation,
        ),
      db
        .prepare(
          "INSERT INTO revisions (hero_id, revision, snapshot, action, created_at, author) SELECT hero_id, revision, draft_json, 'publish', updated_at, updated_by FROM guides WHERE hero_id = ? AND mutation_id = ?",
        )
        .bind(doc.heroId, mutation),
    ]);
  }
  initialized = true;
}
