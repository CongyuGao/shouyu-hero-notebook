import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
const { createGuideExport } = await moduleFrom('lib/guide-export.ts');
const { layoutGuideExport, wrapExportText, EXPORT_WIDTH, EXPORT_MAX_HEIGHT } =
  await moduleFrom('lib/guide-export-canvas.ts');
const source = JSON.parse(readFileSync('data/initial-guides.json', 'utf8'))[0];
const library = JSON.parse(readFileSync('data/initial-library.json', 'utf8'));
const guide = structuredClone(source);
const selected = guide.builds[0];
selected.name = '导出测试流派';
selected.runeIds = ['1504', '2517', '3514'];
selected.runeCounts = { 1504: 10, 2517: 10, 3514: 10, ignored: 10 };
guide.runeLibrary = library.runes;
selected.summary = '仅导出已发布的流派资料。';
selected.notes = '打法备注包含完整说明，不改写具体数值。';
guide.source = 'DO-NOT-EXPORT-SOURCE';
const record = {
  published: guide,
  publishedAt: '2026-09-06T11:00:00Z',
  updatedAt: '2026-09-10T11:00:00Z',
  draft: { ...guide, title: 'PRIVATE-DRAFT' },
};
const model = createGuideExport(
  record,
  selected.id,
  'https://example.com/manage?edit=1#secret-key',
);
assert.equal(model.publishedDate, '2026/09/06');
assert.equal(new URL(model.publicUrl).pathname, '/');
assert.equal(new URL(model.publicUrl).hash, '');
assert.equal(new URL(model.publicUrl).searchParams.get('build'), selected.id);
assert(!JSON.stringify(model).includes('PRIVATE-DRAFT'));
assert(!JSON.stringify(model).includes('DO-NOT-EXPORT-SOURCE'));
assert(!JSON.stringify(model).includes('secret-key'));
assert.throws(
  () =>
    createGuideExport(
      { published: null, publishedAt: null },
      selected.id,
      'https://example.com',
    ),
  /先发布/,
);
assert.throws(
  () => createGuideExport(record, 'missing-build', 'https://example.com'),
  /已发布/,
);
assert.throws(
  () => createGuideExport(record, selected.id, 'javascript:alert(1)'),
  /地址无效/,
);
const choices = model.sections
  .filter((s) => s.title.endsWith('小天赋'))
  .flatMap((s) => s.choices);
assert.equal(
  choices.filter((c) => c.selected).length,
  selected.talentIds.length,
);
assert.equal(choices.length, guide.talents.length);
assert.equal(
  model.sections
    .filter((s) => s.title.endsWith('核心'))
    .flatMap((s) => s.choices)
    .filter((c) => c.selected).length,
  selected.coreIds.length,
);
assert.equal(model.sections.find((s) => s.kind === 'glyphs').choices.length, 6);
assert.equal(
  model.sections.find((s) => s.title === '铭文属性合计').text,
  '物理攻击力+45\n物理穿透+100\n移速+10%',
);
assert.deepEqual(
  model.sections.find((s) => s.kind === 'runes').choices.map((r) => r.color),
  ['红色', '蓝色', '绿色'],
);
const emptyGuide = structuredClone(guide);
emptyGuide.builds[0].talentIds = [];
emptyGuide.builds[0].picks = [
  { talentId: 't01', priority: 'selected', reason: '截图已选' },
];
const empty = createGuideExport(
  { ...record, published: emptyGuide },
  selected.id,
  'https://example.com',
);
assert.equal(
  empty.sections
    .filter((s) => s.title.endsWith('小天赋'))
    .flatMap((s) => s.choices)
    .filter((c) => c.selected).length,
  0,
);
delete emptyGuide.builds[0].talentIds;
const legacy = createGuideExport(
  { ...record, published: emptyGuide },
  selected.id,
  'https://example.com',
  true,
);
assert.equal(
  legacy.sections
    .filter((s) => s.title.endsWith('小天赋'))
    .flatMap((s) => s.choices)
    .filter((c) => c.selected).length,
  1,
);
assert(!JSON.stringify(legacy).includes('截图已选'));
const details = createGuideExport(
  record,
  selected.id,
  'https://example.com',
  true,
);
for (const glyph of guide.glyphs.filter((g) =>
  selected.glyphIds.includes(g.id),
))
  assert(
    details.sections.some((s) => s.text === glyph.effect),
    'Glyph effect must remain verbatim',
  );
for (const talent of guide.talents.filter((t) =>
  selected.talentIds.includes(t.id),
))
  assert(
    details.sections.some((s) => s.text === talent.description),
    'Talent effect must remain verbatim',
  );
assert(details.sections.some((s) => s.text === selected.notes));
const invalid = structuredClone(record);
invalid.published.runeLibrary.find((r) => r.id === '1504').effect +=
  '\n尚不支持的自定义效果';
assert(
  createGuideExport(invalid, selected.id, 'https://example.com').sections.some(
    (s) => s.title === '属性核对提醒',
  ),
);
assert.deepEqual(
  wrapExportText('甲乙\n丙丁🙂', 2, (s) => Array.from(s).length),
  ['甲乙', '丙丁', '🙂'],
);

// Exercise the actual painter, and check every text placement stays in its page.
let activePageHeight = 0;
const painted = [];
const ctx = {
  font: '',
  measureText(value) {
    const px = Number(this.font.match(/(\d+)px/)?.[1] || 36);
    return {
      width:
        Array.from(value).reduce(
          (n, c) => n + (c.charCodeAt(0) < 128 ? 0.55 : 1),
          0,
        ) * px,
    };
  },
  fillText(value, x, y) {
    const size = Number(this.font.match(/(\d+)px/)?.[1] || 36);
    assert(
      x >= 0 && y >= 0 && y + size <= activePageHeight,
      `Text exceeds page: ${value}`,
    );
    assert(
      x + this.measureText(value).width <= EXPORT_WIDTH + 2,
      `Text exceeds width: ${value}`,
    );
    painted.push(value);
  },
  beginPath() {},
  roundRect() {},
  fill() {},
  stroke() {},
  fillRect() {},
  strokeRect() {},
  moveTo() {},
  lineTo() {},
  save() {},
  restore() {},
  clip() {},
  drawImage() {},
  createLinearGradient() {
    return { addColorStop() {} };
  },
  createRadialGradient() {
    return { addColorStop() {} };
  },
};
function checkLayout(input) {
  const pages = layoutGuideExport(input, ctx);
  for (const page of pages) {
    assert(page.height > 0 && page.height <= EXPORT_MAX_HEIGHT);
    activePageHeight = page.height;
    page.operations.forEach((paint) => paint(ctx));
  }
  return pages;
}
const overviewPages = checkLayout(model);
assert.equal(
  overviewPages.length,
  1,
  'Normal overview must fit all skills and loadout on one image',
);
const { blankGuide } = await moduleFrom('lib/guide.ts');
const nuwa = blankGuide('179');
nuwa.title = '女娲攻略';
nuwa.version = '测试版本';
nuwa.author = '测试作者';
const nuwaExport = createGuideExport(
  { published: nuwa, publishedAt: record.publishedAt },
  nuwa.builds[0].id,
  'https://example.com',
);
assert(
  nuwaExport.sections.some((section) => section.title === '四技能 · 小天赋'),
);
assert.equal(
  nuwaExport.sections
    .filter((section) => section.title.endsWith('小天赋'))
    .flatMap((section) => section.choices).length,
  32,
);
assert.equal(
  checkLayout(nuwaExport).length,
  1,
  'Four-skill overview must fit one image',
);
const detailPages = checkLayout(details);
assert(detailPages.length > overviewPages.length);
assert(painted.includes('✓ 已选') && painted.includes('— 未选'));
const long = structuredClone(details);
long.buildName = '很长的流派名称'.repeat(7);
long.sections.push({
  title: '跨页完整文字',
  kind: 'text',
  text: '完整效果必须保留数值 123.45%。\n'.repeat(180),
});
const longPages = checkLayout(long);
assert(longPages.length > detailPages.length);
const tight = {
  ...model,
  buildName: '导出测试',
  version: '正式服',
  author: '测试',
  publicUrl: 'https://example.com/?hero=166&build=a',
  sections: [
    {
      title: '小天赋',
      kind: 'choices',
      choices: Array.from({ length: 12 }, () => ({
        name: '天赋名'.repeat(7),
        selected: true,
      })),
    },
  ],
};
assert.equal(
  checkLayout(tight).length,
  1,
  'Spacing alone must not create an empty page',
);
console.log(
  `PASS: published-only snapshots, selected cores/talents, exact rune stats, glyph text, privacy-safe link, ${overviewPages.length} overview pages and ${detailPages.length} detail pages`,
);
console.log(
  'PASS: long text pagination preserves content; every painted text stays within the image bounds',
);

// Optional real-canvas artifact check, using a caller-provided local runtime.
// It is a test fixture only: no saved guide or published selection is changed.
if (process.env.SHOUYU_CANVAS_MODULE && process.env.SHOUYU_EXPORT_RENDER_DIR) {
  const { createCanvas, loadImage } = require(process.env.SHOUYU_CANVAS_MODULE);
  const assets = new Map();
  for (const section of model.sections)
    for (const choice of section.choices || []) {
      if (!choice.image?.startsWith('/') || assets.has(choice.image)) continue;
      const image = await loadImage(join('public', choice.image));
      Object.defineProperties(image, {
        naturalWidth: { value: image.width },
        naturalHeight: { value: image.height },
      });
      assets.set(choice.image, image);
    }
  const canvas = createCanvas(EXPORT_WIDTH, 1);
  const context = canvas.getContext('2d');
  const pages = layoutGuideExport(model, context, assets);
  mkdirSync(process.env.SHOUYU_EXPORT_RENDER_DIR, { recursive: true });
  for (const [index, page] of pages.entries()) {
    canvas.height = page.height;
    page.operations.forEach((paint) => paint(context));
    const filename = join(
      process.env.SHOUYU_EXPORT_RENDER_DIR,
      `test-fixture-${index + 1}.png`,
    );
    writeFileSync(filename, canvas.toBuffer('image/png'));
    console.log(
      `Rendered test fixture: ${filename} (${EXPORT_WIDTH}x${page.height})`,
    );
  }
}
