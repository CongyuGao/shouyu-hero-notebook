import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { build } = await import(
  require.resolve('esbuild', { paths: [require.resolve('wrangler')] })
);
const output = await build({
  entryPoints: ['lib/catalog-order.ts'],
  bundle: true,
  format: 'esm',
  write: false,
});
const { sortCatalogItems, catalogViewItems } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`
);
const library = JSON.parse(readFileSync('data/initial-library.json', 'utf8'));
const original = JSON.stringify(library);
const glyphs = sortCatalogItems('glyphs', library.glyphs);
assert.deepEqual(
  glyphs.slice(0, 2).map((item) => item.name),
  ['火池术', '双极制裁'],
);
for (const [a, b] of [
  [23, 22],
  [22, 21],
  [39, 11],
  [39, 33],
  [38, 37],
  [25, 13],
  [26, 12],
]) {
  const index = (number) =>
    glyphs.findIndex(
      (item) => item.id === `doc-glyph-${String(number).padStart(3, '0')}`,
    );
  assert(index(a) < index(b));
}
assert.equal(
  JSON.stringify(library),
  original,
  'Sorting never mutates or rewrites effects',
);
const unknown = [
  { id: 'custom-b', name: '乙', effect: '原文B', usage: '' },
  { id: 'custom-a', name: '甲', effect: '原文A', usage: '' },
];
assert.deepEqual(
  sortCatalogItems('glyphs', [...unknown, ...library.glyphs]).slice(-2),
  unknown,
);
assert.deepEqual(
  [
    ...new Set(
      sortCatalogItems('runes', library.runes).map((item) => item.color),
    ),
  ],
  ['蓝色', '绿色', '红色'],
);
const saved = { ...library.glyphs[0], effect: '已发布效果原文' };
const latest = { ...saved, effect: '尚未同步的新效果' };
assert.equal(
  catalogViewItems('glyphs', [saved], [latest], [saved.id])[0].effect,
  saved.effect,
);
assert.equal(
  catalogViewItems('glyphs', [saved], [latest], [])[0].effect,
  latest.effect,
);
const component = readFileSync('components/loadout-picker.tsx', 'utf8');
assert.match(
  component,
  /catalogList\.current\),\s*\[open, colorFilter, query\]/,
);
assert.match(component, /没有匹配的条目/);
console.log(
  'PASS: source-based stable glyph ordering, blue-green-red runes, unchanged effect text, selected snapshot fidelity, filter-only scroll resets and empty search feedback.',
);
