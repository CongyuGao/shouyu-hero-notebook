// Generate a review artifact from local OCR; never writes website data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHOUYU_SHARP_MODULE || 'sharp');
const dir = process.argv[2];
const heroes = JSON.parse(fs.readFileSync('data/official.json', 'utf8')).heroes;
const pages = [];
const bands = [
  [0.193, 0.309],
  [0.37, 0.487],
  [0.498, 0.616],
  [0.626, 0.745],
  [0.752, 0.875],
];
for (const name of fs
  .readdirSync(dir)
  .filter((n) => /^IMG_\d+\.json$/.test(n))
  .sort()) {
  const page = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  const number = Number(name.match(/\d+/)[0]);
  const heroText = page.rows
    .filter((r) => r.x < 0.12 && r.y > 0.92)
    .map((r) => r.text)
    .join('');
  const heroName =
    number >= 1588 && number <= 1590
      ? '张飞'
      : number >= 1613 && number <= 1615
        ? '暃'
        : number === 1611
          ? '女娲'
          : heroes.find((h) => heroText.includes(h.name))?.name;
  if (!heroName) throw Error(`Unknown hero ${name}: ${heroText}`);
  const hero = heroes.find((h) => h.name === heroName);
  const { data, info } = await sharp(page.file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const selected = (column, row) => {
    let green = 0;
    const xs = column ? [0.746, 0.777] : [0.42, 0.452];
    const startY = bands[row][0];
    for (
      let y = Math.floor(startY * info.height);
      y < (startY + 0.044) * info.height;
      y++
    )
      for (
        let x = Math.floor(xs[0] * info.width);
        x < xs[1] * info.width;
        x++
      ) {
        const i = (y * info.width + x) * info.channels;
        const [r, g, b] = data.subarray(i, i + 3);
        if (g > 155 && g > r * 1.4 && g > b * 1.08) green++;
      }
    return { selected: green > 50, greenPixels: green };
  };
  const cards = bands.flatMap(([top, bottom], row) =>
    [0, 1].map((column) => {
      const rows = page.rows
        .filter(
          (r) =>
            r.y >= top &&
            r.y < bottom &&
            r.x >= (column ? 0.516 : 0.19) &&
            r.x < (column ? 0.782 : 0.457),
        )
        .sort((a, b) => a.y - b.y);
      return {
        kind: row === 0 ? 'core' : 'talent',
        position: row === 0 ? column + 1 : (row - 1) * 2 + column + 1,
        name: rows[0]?.text || '',
        description: rows
          .slice(1)
          .map((r) => r.text)
          .join(''),
        confidence: Math.min(...rows.map((r) => r.confidence)),
        ...selected(column, row),
      };
    }),
  );
  pages.push({
    file: page.file,
    filename: name.replace('.json', '.PNG'),
    heroId: hero.id,
    heroName,
    hash: crypto
      .createHash('sha256')
      .update(fs.readFileSync(page.file))
      .digest('hex'),
    cards,
  });
}
const groups = new Map();
for (const page of pages) {
  const existing = groups.get(page.heroId) || [];
  page.skill = (existing.length % (page.heroName === '女娲' ? 4 : 3)) + 1;
  existing.push(page);
  groups.set(page.heroId, existing);
}
fs.writeFileSync(
  path.join(dir, 'parsed-review.json'),
  JSON.stringify(pages, null, 2) + '\n',
);
console.log(
  `${pages.length} images, ${groups.size} heroes. Review artifact only.`,
);
for (const pages of groups.values())
  console.log(
    `${pages[0].heroName}: ${pages.map((p) => p.filename).join(', ')}; ${pages.map((p) => p.cards.filter((c) => c.selected).length).join('/')} selected cards`,
  );
