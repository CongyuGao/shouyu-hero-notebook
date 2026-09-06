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
const { blankGuide, chooseTalent, validateGuide, heroSkills } =
  await moduleFrom('lib/guide.ts');
const source = JSON.parse(readFileSync('data/initial-guides.json', 'utf8'))[0];
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
console.log(
  'PASS: optional build prose, minimum one talent, fourth-skill limits, and removing only rune selections',
);
