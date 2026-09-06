import assert from 'node:assert/strict';
import {
  blankGuide,
  chooseTalent,
  selectedTalents,
  validateGuide,
} from '../lib/guide';
const guide = blankGuide('166');
let build = guide.builds[0];
for (const skill of [1, 2, 3]) {
  const candidates = guide.talents.filter((t) => t.skill === skill);
  assert.equal(candidates.length, 8);
  for (const talent of candidates.slice(0, 6))
    build = {
      ...build,
      ...chooseTalent(build, talent.id, true, guide.talents),
    };
  const before = structuredClone(build);
  assert.throws(
    () => chooseTalent(build, candidates[6].id, true, guide.talents),
    /本技能/,
  );
  assert.deepEqual(
    build,
    before,
    'rejected selection must preserve the entire build',
  );
}
assert.equal(
  selectedTalents(build).length,
  18,
  'each of three skills can independently select six',
);
guide.builds[0] = build;
assert.equal(validateGuide(guide).builds[0].talentIds.length, 18);
const first = guide.talents.filter((t) => t.skill === 1);
assert.throws(
  () =>
    validateGuide({
      ...guide,
      builds: [{ ...build, talentIds: [...build.talentIds, first[6].id] }],
    }),
  /一技能最多选择6/,
);
build = { ...build, ...chooseTalent(build, first[0].id, false, guide.talents) };
build = { ...build, ...chooseTalent(build, first[6].id, true, guide.talents) };
assert.equal(build.talentIds.length, 18);
assert(!build.talentIds.includes(first[0].id));
assert(build.talentIds.includes(first[6].id));
const legacy = {
  ...guide.builds[0],
  talentIds: undefined,
  picks: first
    .slice(0, 6)
    .map((t) => ({ talentId: t.id, priority: 'selected', reason: '' })),
} as unknown as typeof build;
assert.equal(selectedTalents(legacy).length, 6);
assert.equal(
  chooseTalent(
    legacy,
    guide.talents.find((t) => t.skill === 2)!.id,
    true,
    guide.talents,
  ).talentIds!.length,
  7,
);
console.log(
  'PASS: 8 candidates per skill; 6 + 6 + 6 accepted; each seventh rejected; cancel/reselect and legacy selections preserved.',
);
