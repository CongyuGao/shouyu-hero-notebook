// Assemble reviewed local transcriptions. Default is preview-only; --write
// requires --review-confirmed after every source image has been checked.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir = process.argv[2];
const pages = JSON.parse(
  fs.readFileSync(path.join(dir, 'parsed-review.json'), 'utf8'),
);
const corrections = JSON.parse(
  fs.readFileSync('data/talent-photo-corrections.json', 'utf8'),
);
assert.equal(pages.length, 121);
assert.equal(new Set(pages.map((p) => p.filename)).size, 121);
for (const patch of corrections) {
  const page = pages.find((p) => p.filename === patch.file);
  const card = page?.cards.find(
    (c) => c.kind === patch.kind && c.position === patch.position,
  );
  assert(card, `Unknown correction ${JSON.stringify(patch)}`);
  for (const field of ['name', 'description', 'selected'])
    if (field in patch) card[field] = patch[field];
}
const normalize = (text) => text.replace(/％/g, '%').trim();
const groups = new Map();
for (const page of pages) {
  const group = groups.get(page.heroId) || [];
  group.push(page);
  groups.set(page.heroId, group);
}
assert.equal(groups.size, 39);
let conflicts = 0;
const imported = [...groups.values()].map((group) => {
  const skills = new Map();
  for (const page of group) {
    if (skills.has(page.skill)) {
      const first = skills.get(page.skill);
      for (const card of page.cards) {
        const other = first.cards.find(
          (c) => c.kind === card.kind && c.position === card.position,
        );
        for (const field of ['name', 'description', 'selected'])
          if (
            normalize(String(card[field])) !== normalize(String(other[field]))
          ) {
            console.log(
              `REVIEW duplicate difference: ${first.filename}/${page.filename} ${card.kind} ${card.position} ${field}: ${other[field]} <> ${card[field]}`,
            );
            conflicts++;
          }
      }
      first.sources.push(page.filename);
    } else skills.set(page.skill, { ...page, sources: [page.filename] });
  }
  const expectedSkills = group[0].heroName === '女娲' ? 4 : 3;
  assert.equal(skills.size, expectedSkills);
  const talents = [],
    cores = [],
    selectedCoreIds = [],
    selectedTalentIds = [];
  for (const [skill, page] of [...skills.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    for (const card of page.cards) {
      assert(
        card.name && card.description,
        `${page.filename} ${card.kind} ${card.position} incomplete`,
      );
      const id =
        card.kind === 'core'
          ? `c${(skill - 1) * 2 + card.position}`
          : `t${String((skill - 1) * 8 + card.position).padStart(2, '0')}`;
      const value = {
        id,
        name: normalize(card.name),
        description: normalize(card.description),
        skill,
        source: page.sources.join('、'),
      };
      (card.kind === 'core' ? cores : talents).push(value);
      if (card.selected)
        (card.kind === 'core' ? selectedCoreIds : selectedTalentIds).push(id);
    }
  }
  return {
    heroId: group[0].heroId,
    heroName: group[0].heroName,
    source: `玩家提供的游戏内天赋资料 ${group[0].filename}—${group.at(-1).filename}。适用游戏版本待确认；原图勾选仅作参考加点，可自行调整。`,
    talents,
    cores,
    referenceSelection: {
      coreIds: selectedCoreIds,
      talentIds: selectedTalentIds,
      source: group.map((p) => p.filename).join('、'),
    },
  };
});
assert.equal(
  conflicts,
  0,
  'Resolve every duplicate discrepancy before importing',
);
const old = JSON.parse(fs.readFileSync('data/hero-talents.json', 'utf8'));
const merged = [
  ...old.filter((p) => !imported.some((n) => n.heroId === p.heroId)),
  ...imported,
];
fs.writeFileSync(
  path.join(dir, 'reviewed-reference-candidate.json'),
  JSON.stringify(merged, null, 2) + '\n',
);
if (process.argv.includes('--write')) {
  assert(
    process.argv.includes('--review-confirmed'),
    'All images must be manually reviewed first',
  );
  fs.writeFileSync(
    'data/hero-talents.json',
    JSON.stringify(merged, null, 2) + '\n',
  );
}
console.log(
  `${process.argv.includes('--write') ? 'Imported' : 'Preview'}: ${imported.length} heroes, ${imported.reduce((n, p) => n + p.talents.length, 0)} talents, ${imported.reduce((n, p) => n + p.cores.length, 0)} cores from 121 photos (${pages.length - imported.reduce((n, p) => n + p.cores.length / 2, 0)} duplicate skill pages).`,
);
