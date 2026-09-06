import assert from 'node:assert/strict';
import presets from '../data/hero-talents.json';
import {
  blankGuide,
  heroTalentPreset,
  heroes,
  validateGuide,
} from '../lib/guide';
import { heroTemplate } from '../lib/hero-template';
import { initialRoster, rosterHeroIds } from '../lib/mode-roster';

assert(presets.length > 0, 'Reference data must be populated before release');
for (const entry of presets) {
  assert(
    heroes.some((h) => h.id === entry.heroId && h.name === entry.heroName),
  );
  const guide = blankGuide(entry.heroId);
  assert.equal(guide.talents.length, 24);
  assert.equal(guide.cores.length, 6);
  for (const skill of [1, 2, 3]) {
    assert.equal(guide.talents.filter((t) => t.skill === skill).length, 8);
    assert.equal(guide.cores.filter((c) => c.skill === skill).length, 2);
  }
  assert.equal(guide.builds[0].name, '', 'Do not invent a build');
  for (const field of ['talentIds', 'coreIds', 'glyphIds', 'runeIds'] as const)
    assert.deepEqual(
      guide.builds[0][field],
      [],
      'Do not import screenshot choices',
    );
  assert.equal(
    guide.verified,
    false,
    'An unknown game version is not verified',
  );
  assert(!guide.tier, 'Do not invent a rating');
  validateGuide(guide);
  const template = heroTemplate(entry.heroId);
  assert.equal(template.published, null);
  assert.equal(template.publishedAt, null);
  assert.equal(template.revision, 0);
  const originalName = guide.talents[0].name;
  guide.talents[0].name = 'independent local edit';
  assert.equal(blankGuide(entry.heroId).talents[0].name, originalName);
  assert.equal(heroTalentPreset(entry.heroId)?.talents[0]?.name, originalName);
  console.log(
    `PASS ${entry.heroName}: reference data, empty build, editable isolated template`,
  );
}
assert.equal(
  rosterHeroIds(initialRoster).length,
  42,
  'Do not expand the approved roster',
);
for (const name of ['狄仁杰', '王昭君']) {
  const hero = heroes.find((h) => h.name === name)!;
  assert(!rosterHeroIds(initialRoster).includes(hero.id));
}
console.log('PASS: approved 42-hero roster remains unchanged');
