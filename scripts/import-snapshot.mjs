import fs from 'node:fs';
const dir = process.argv[2];
const read = (n) => JSON.parse(fs.readFileSync(`${dir}/${n}.json`, 'utf8'));
const plain = (s) =>
  (Array.isArray(s) ? s.join('\n') : String(s || ''))
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
const roles = {
  1: '战士',
  2: '法师',
  3: '坦克',
  4: '刺客',
  5: '射手',
  6: '辅助',
};
const heroes = read('herolist').map((h) => ({
  id: String(h.ename),
  name: h.cname,
  pinyin: h.id_name,
  title: h.title,
  roles: [roles[h.hero_type], roles[h.hero_type2]].filter(Boolean),
  avatar: `https://game.gtimg.cn/images/yxzj/img201606/heroimg/${h.ename}/${h.ename}.jpg`,
}));
const runes = read('ming')
  .filter((m) => String(m.ming_grade) === '5')
  .map((m) => ({
    id: String(m.ming_id),
    name: m.ming_name,
    grade: 5,
    color: { red: '红色', yellow: '蓝色', blue: '绿色' }[m.ming_type],
    description: plain(m.ming_des),
  }));
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync(
  'data/official.json',
  JSON.stringify({ fetchedAt: '2026-09-06', heroes, runes }, null, 2) + '\n',
);
console.log(
  `Imported ${heroes.length} heroes and ${runes.length} reference runes; no normal equipment`,
);
