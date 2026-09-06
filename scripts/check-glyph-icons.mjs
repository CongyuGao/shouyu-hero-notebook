import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { build } = await import(
  require.resolve('esbuild', { paths: [require.resolve('wrangler')] })
);
async function from(path) {
  const output = await build({
    entryPoints: [path],
    bundle: true,
    format: 'esm',
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`
  );
}
const { glyphArtwork } = await from('lib/glyph-art.ts');
const { createGuideExport } = await from('lib/guide-export.ts');
const library = JSON.parse(readFileSync('data/initial-library.json', 'utf8'));
const current = library.glyphs.find(
  (item) => item.id === 'user-glyph-shunxi-baoji',
);
assert.equal(current.icon, '/glyph-icons/shunxi-baoji.png');
assert(existsSync('public' + current.icon));
assert.equal(current.effect, '释放技能后增加50%暴击率，持续3秒');
const legacy = { ...current, icon: undefined };
assert.deepEqual(glyphArtwork(legacy), {
  image: current.icon,
  cardImage: false,
});
assert.deepEqual(glyphArtwork({ ...legacy, icon: '/my-own-icon.png' }), {
  image: '/my-own-icon.png',
  cardImage: false,
});
assert.deepEqual(glyphArtwork({ ...legacy, image: '/my-own-card.png' }), {
  image: '/my-own-card.png',
  cardImage: true,
});
assert.equal(glyphArtwork({ id: 'unrelated' }).image, undefined);
assert.equal(glyphArtwork(undefined).image, undefined);
for (const item of library.glyphs.filter((item) => item.id !== current.id))
  assert.deepEqual(glyphArtwork(item), {
    image: item.icon || item.image,
    cardImage: !item.icon && !!item.image,
  });
const guide = JSON.parse(readFileSync('data/initial-guides.json', 'utf8'))[0];
guide.glyphs = [legacy];
guide.builds[0].glyphIds = [legacy.id];
const before = JSON.stringify(guide);
const model = createGuideExport(
  { published: guide, publishedAt: '2026-09-07T00:00:00.000Z' },
  guide.builds[0].id,
  'https://example.com',
  true,
);
for (const kind of ['glyphs', 'glyph-details']) {
  const choice = model.sections.find((section) => section.kind === kind)
    .choices[0];
  assert.equal(choice.image, current.icon);
  assert.equal(choice.cardImage, false);
  if (kind === 'glyph-details') assert.equal(choice.effect, current.effect);
}
assert.equal(
  JSON.stringify(guide),
  before,
  'No snapshot is rewritten to repair its icon',
);
console.log(
  'PASS: original glyph icon in new and old snapshots, explicit images respected, all other icons unchanged, overview/detail exports use the full original artwork.',
);
