import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { build } = await import(
  require.resolve('esbuild', { paths: [require.resolve('wrangler')] })
);
async function moduleFrom(path) {
  const compiled = await build({
    entryPoints: [path],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
  );
}
await moduleFrom('scripts/check-talents.ts');
await moduleFrom('scripts/check-hero-presets.ts');
const {
  blankGuide,
  chooseTalent,
  validateGuide,
  heroSkills,
  guideSkillLabels,
  validateSkillLabels,
} = await moduleFrom('lib/guide.ts');
const { createGuideExport } = await moduleFrom('lib/guide-export.ts');
const source = JSON.parse(readFileSync('data/initial-guides.json', 'utf8'))[0];
const fei = blankGuide('542');
assert.deepEqual(
  fei.cores.filter((c) => c.skill === 1).map((c) => c.name),
  ['回玉之刃', '美玉赠英雄'],
);
assert.deepEqual(
  fei.talents.filter((t) => t.skill === 1).map((t) => t.name),
  [
    '一来二去',
    '璀璨',
    '金玉其外',
    '丝雨回风',
    '凝琼',
    '玉音回响',
    '汹涌',
    '玉树临风',
  ],
);
assert.equal(fei.cores.find((c) => c.skill === 2).name, '路转锋回');
assert(
  fei.talents
    .filter((t) => t.skill === 1)
    .every((t) => /IMG_316[45]\.PNG/.test(t.source)),
);
source.builds[0].name = '';
source.builds[0].summary = '';
source.builds[0].notes = '';
assert.doesNotThrow(
  () => validateGuide(source, true),
  'Unnamed builds with no prose may be published',
);
assert.throws(
  () =>
    validateGuide(
      { ...source, builds: [{ ...source.builds[0], talentIds: [] }] },
      true,
    ),
  /至少一个/,
);
const nuwa = blankGuide('179');
assert.deepEqual(heroSkills('179'), [1, 2, 3, 4]);
assert.equal(nuwa.talents.length, 32);
assert.equal(nuwa.cores.length, 8);
nuwa.builds[0].talentIds = [];
const fourth = nuwa.talents.filter((t) => t.skill === 4);
for (const talent of fourth.slice(0, 6))
  Object.assign(
    nuwa.builds[0],
    chooseTalent(nuwa.builds[0], talent.id, true, nuwa.talents),
  );
assert.throws(
  () => chooseTalent(nuwa.builds[0], fourth[6].id, true, nuwa.talents),
  /本技能/,
);
assert.equal(
  validateGuide(nuwa).talents.filter((t) => t.skill === 4).length,
  8,
);
assert.throws(
  () =>
    validateGuide({
      ...nuwa,
      builds: [{ ...nuwa.builds[0], talentIds: fourth.map((t) => t.id) }],
    }),
  /四技能最多选择6/,
);
const removed = {
  ...source,
  builds: [{ ...source.builds[0], runeIds: [], runeCounts: {} }],
};
assert.equal(validateGuide(removed, true).builds[0].runeIds.length, 0);
assert.deepEqual(removed.builds[0].coreIds, source.builds[0].coreIds);
// Renaming a group must survive persistence and reach exports without moving
// the underlying items or changing the per-group selection limits.
assert.deepEqual(guideSkillLabels(source), [
  '未分组',
  '一技能',
  '二技能',
  '三技能',
  '四技能',
]);
const renamed = validateGuide(
  { ...source, skillLabels: { 1: '二技能', 2: '一技能', 3: '斩杀 · 大招' } },
  true,
);
const restored = validateGuide(JSON.parse(JSON.stringify(renamed)), true);
assert.deepEqual(restored.skillLabels, renamed.skillLabels);
assert.deepEqual(restored.talents, validateGuide(source).talents);
assert.deepEqual(restored.cores, validateGuide(source).cores);
assert.deepEqual(restored.builds, validateGuide(source).builds);
const exportModel = createGuideExport(
  { published: restored, publishedAt: '2026-09-07T00:00:00Z' },
  restored.builds[0].id,
  'https://example.com',
  true,
);
assert.equal(exportModel.sections[0].title, '二技能 · 核心');
assert.equal(exportModel.sections[2].title, '一技能 · 核心');
assert(exportModel.sections.some((s) => s.title === '斩杀 · 大招 · 小天赋'));
assert.deepEqual(validateSkillLabels({ 1: '   ', 2: '二技能' }), {});
assert.deepEqual(
  guideSkillLabels(validateGuide({ ...renamed, skillLabels: {} })),
  guideSkillLabels(source),
);
for (const invalid of [
  { 1: '字'.repeat(17) },
  { 5: '五技能' },
  { 1: 12 },
  ['一技能'],
])
  assert.throws(() => validateGuide({ ...source, skillLabels: invalid }));
assert.throws(
  () =>
    validateGuide({
      ...nuwa,
      skillLabels: { 4: '自定义大招' },
      builds: [{ ...nuwa.builds[0], talentIds: fourth.map((t) => t.id) }],
    }),
  /自定义大招最多选择6/,
);
console.log(
  'PASS: optional build prose, talent limits, rune removal, saved custom skill names and published export labels',
);
