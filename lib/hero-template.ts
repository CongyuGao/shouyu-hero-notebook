import { blankGuide, heroes, type GuideRecord } from './guide';

// Public reference data plus empty build slots, not an invented published guide.
// This display template is never inserted into the guide database.
export function heroTemplate(heroId: string): GuideRecord {
  if (!heroes.some((h) => h.id === heroId)) throw new Error('未知英雄');
  const draft = blankGuide(heroId);
  draft.builds[0].id = `template-${heroId}`;
  return {
    heroId,
    revision: 0,
    updatedAt: '',
    publishedAt: null,
    published: null,
    draft,
  };
}
export type GuideEditTarget =
  | { kind: 'core' | 'talent'; id: string }
  | { kind: 'glyphs' | 'runes' };
