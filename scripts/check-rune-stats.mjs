import assert from 'node:assert/strict';
import initial from '../data/initial-library.json' with { type: 'json' };
import { aggregateRuneStats, parseRuneEffect } from '../lib/rune-stats.ts';

for (const rune of initial.runes) {
  const parsed = parseRuneEffect(rune.effect, rune);
  assert.equal(
    parsed.issues.length,
    0,
    `${rune.name}: ${JSON.stringify(parsed.issues)}`,
  );
  assert(parsed.parts.length > 0);
}

const pierce = aggregateRuneStats(initial.runes, {
  1504: 10,
  2517: 10,
  3514: 10,
});
assert.equal(pierce.complete, true);
assert.equal(pierce.runeTotal, 30);
assert.deepEqual(
  pierce.totals.map((item) => item.display),
  ['物理攻击力+45', '物理穿透+100', '移速+10%'],
);

const decimals = aggregateRuneStats(initial.runes, {
  2515: 7,
  2520: 3,
  3509: 10,
});
assert.deepEqual(
  decimals.totals.map((item) => item.display),
  ['最大生命+690', '生命回复+36.4', '移速+5.8%', '攻速加成+3%', '冷却缩减+6%'],
);

const exact = aggregateRuneStats(
  [{ id: 'x', name: '精度', effect: '移速+0.1%', usage: '' }],
  { x: 3 },
);
assert.equal(exact.totals[0].display, '移速+0.3%');

const custom = aggregateRuneStats(
  [
    {
      id: 'custom',
      name: '自定义',
      effect: '攻击时有概率触发雷击\n物理攻击力+2',
      usage: '',
    },
  ],
  { custom: 4 },
);
assert.equal(custom.complete, false);
assert.deepEqual(
  custom.totals.map((item) => item.display),
  ['物理攻击力+8'],
);
assert.equal(custom.issues[0].type, 'unparsed-effect');
assert.match(custom.issues[0].message, /未计入合计/);

const unitMismatch = aggregateRuneStats(
  [{ id: 'x', name: '错误单位', effect: '暴击率+2', usage: '' }],
  { x: 1 },
);
assert.equal(unitMismatch.totals.length, 0);
assert.equal(unitMismatch.issues[0].type, 'unit-mismatch');

console.log('PASS: actual rune-stats parses all 30 official effects');
console.log('PASS: actual rune-stats exact totals and decimal display');
console.log(
  'PASS: actual rune-stats reports unknown or mismatched lines without guessing',
);
