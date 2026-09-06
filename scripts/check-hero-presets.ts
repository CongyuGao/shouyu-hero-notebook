import assert from 'node:assert/strict';
import presets from '../data/hero-talents.json';
import publishedSeeds from '../data/initial-guides.json';
import {
  blankGuide,
  heroTalentPreset,
  heroes,
  heroSkills,
  fillBlankHeroReference,
  selectNewGuideHero,
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
  assert.equal(guide.talents.length, heroSkills(entry.heroId).length * 8);
  assert.equal(guide.cores.length, heroSkills(entry.heroId).length * 2);
  for (const skill of heroSkills(entry.heroId)) {
    assert.equal(guide.talents.filter((t) => t.skill === skill).length, 8);
    assert.equal(guide.cores.filter((c) => c.skill === skill).length, 2);
  }
  assert.equal(guide.builds[0].name, '', 'Do not invent a build');
  const reference = heroTalentPreset(entry.heroId)?.referenceSelection;
  for (const field of ['talentIds', 'coreIds', 'glyphIds', 'runeIds'] as const)
    assert.deepEqual(
      guide.builds[0][field],
      field === 'coreIds' || field === 'talentIds'
        ? reference?.[field] || []
        : [],
      'Only explicitly supplied reference choices may populate a new template',
    );
  assert.equal(
    guide.verified,
    false,
    'An unknown game version is not verified',
  );
  assert(!guide.tier, 'Do not invent a rating');
  validateGuide(guide);
  const generic = blankGuide();
  const genericBuildId = generic.builds[0].id;
  const initialized = selectNewGuideHero(generic, entry.heroId);
  assert.equal(initialized.talents.length, guide.talents.length);
  assert.equal(initialized.cores.length, guide.cores.length);
  assert.deepEqual(initialized.builds[0].talentIds, guide.builds[0].talentIds);
  assert.deepEqual(initialized.builds[0].coreIds, guide.builds[0].coreIds);
  assert.equal(initialized.builds[0].id, genericBuildId);
  assert.equal(generic.heroId, '');
  validateGuide(initialized);
  const template = heroTemplate(entry.heroId);
  assert.equal(template.published, null);
  assert.equal(template.publishedAt, null);
  assert.equal(template.revision, 0);
  const originalName = guide.talents[0].name;
  guide.talents[0].name = 'independent local edit';
  assert.equal(blankGuide(entry.heroId).talents[0].name, originalName);
  assert.equal(heroTalentPreset(entry.heroId)?.talents[0]?.name, originalName);
  const edited = structuredClone(guide);
  edited.talents[1] = { ...edited.talents[1], name: '', description: '' };
  edited.builds[0].name = '自定流派';
  edited.verified = true;
  const filled = fillBlankHeroReference(edited);
  assert.equal(filled.talents[0].name, 'independent local edit');
  assert.equal(filled.talents[1].name, entry.talents[1].name);
  assert.equal(
    filled.verified,
    false,
    'New reference data needs author verification',
  );
  const unchanged = blankGuide(entry.heroId);
  unchanged.verified = true;
  assert.equal(
    fillBlankHeroReference(unchanged).verified,
    true,
    'No-op fills preserve verification',
  );
  assert.deepEqual(
    filled.builds,
    edited.builds,
    'Reference fill must never change a build',
  );
  assert.equal(
    edited.talents[1].name,
    '',
    'Do not mutate the existing document',
  );
  const conflicting = blankGuide(entry.heroId);
  conflicting.builds[0].talentIds = [];
  conflicting.talents[0].name = conflicting.talents[1].name;
  conflicting.talents[1].name = '';
  conflicting.talents[1].description = '';
  validateGuide(conflicting);
  const safeFill = fillBlankHeroReference(conflicting);
  assert.equal(safeFill.talents[1].name, '');
  validateGuide(safeFill);
  const customCores = blankGuide(entry.heroId);
  customCores.cores = customCores.cores.map((core) => ({
    ...core,
    id: `custom-${core.id}`,
    name: `custom-${core.name}`,
  }));
  customCores.builds[0].coreIds = [];
  const customFilled = fillBlankHeroReference(customCores);
  assert.deepEqual(customFilled.cores, customCores.cores);
  validateGuide(customFilled);
  const authored = blankGuide();
  authored.talents[0].name = '自定义天赋';
  authored.talents[0].description = '保留原有文字';
  authored.builds[0].name = '自定名称';
  const authoredResult = selectNewGuideHero(authored, entry.heroId);
  assert.deepEqual(authoredResult.talents[0], authored.talents[0]);
  assert.deepEqual(authoredResult.builds, authored.builds);
  console.log(
    `PASS ${entry.heroName}: reference data, unnamed editable isolated template`,
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
const coveredHeroIds = new Set([
  ...presets.map((entry) => entry.heroId),
  ...publishedSeeds.map((entry) => entry.heroId),
]);
for (const heroId of rosterHeroIds(initialRoster))
  assert(
    coveredHeroIds.has(heroId),
    `Missing reference data for approved hero ${heroId}`,
  );
console.log('PASS: approved 42-hero roster remains unchanged');
