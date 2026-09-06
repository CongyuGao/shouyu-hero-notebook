import type { CatalogItem } from './catalog';
type Decimal = { units: bigint; scale: number };
type Issue = {
  type: string;
  runeId: string;
  runeName: string;
  line: string;
  message: string;
};
type Part = { stat: string; unit: string; value: Decimal; line: string };
const STAT_UNITS = new Map([
  ['法术攻击力', 'flat'],
  ['物理攻击力', 'flat'],
  ['物理穿透', 'flat'],
  ['最大生命', 'flat'],
  ['物理防御力', 'flat'],
  ['法术穿透', 'flat'],
  ['生命回复', 'flat'],
  ['法术防御力', 'flat'],
  ['物理吸血', 'percent'],
  ['暴击率', 'percent'],
  ['暴击效果', 'percent'],
  ['攻速加成', 'percent'],
  ['法术吸血', 'percent'],
  ['移速', 'percent'],
  ['冷却缩减', 'percent'],
]);

const ten = (power: number) => BigInt(10) ** BigInt(power);

function decimal(token: string, sign: string) {
  const [whole, fraction = ''] = token.split('.');
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0';
  return {
    units: BigInt(digits) * (sign === '-' ? BigInt(-1) : BigInt(1)),
    scale: fraction.length,
  };
}

function add(left: Decimal, right: Decimal) {
  const scale = Math.max(left.scale, right.scale);
  return {
    units:
      left.units * ten(scale - left.scale) +
      right.units * ten(scale - right.scale),
    scale,
  };
}

function multiply(value: Decimal, count: number) {
  return { units: value.units * BigInt(count), scale: value.scale };
}

function formatDecimal(value: Decimal) {
  const negative = value.units < BigInt(0);
  const absolute = negative ? -value.units : value.units;
  if (!value.scale) return `${negative ? '-' : ''}${absolute}`;
  const digits = absolute.toString().padStart(value.scale + 1, '0');
  const whole = digits.slice(0, -value.scale);
  const fraction = digits.slice(-value.scale).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function parseRuneEffect(
  effect: string,
  rune: Partial<CatalogItem> = {},
) {
  const issues: Issue[] = [];
  if (typeof effect !== 'string' || !effect.trim()) {
    return {
      parts: [],
      issues: [
        {
          type: 'empty-effect',
          runeId: rune.id || '',
          runeName: rune.name || '',
          line: '',
          message: `${rune.name || '该铭文'}效果为空，未计入合计。`,
        },
      ],
    };
  }
  const parts: Part[] = [];
  const lines = effect.replace(/\r\n?/g, '\n').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const match =
      /^(.+?)\s*([+＋\-−－])\s*(\d+(?:\.\d{1,6})?)\s*(%|％)?$/u.exec(line);
    if (!match) {
      issues.push({
        type: 'unparsed-effect',
        runeId: rune.id || '',
        runeName: rune.name || '',
        line,
        message: `${rune.name || '自定义铭文'}：“${line}”无法可靠解析，已保留提示且未计入合计。`,
      });
      continue;
    }
    const stat = match[1].trim();
    const unit = match[4] ? 'percent' : 'flat';
    const expected = STAT_UNITS.get(stat);
    if (!expected) {
      issues.push({
        type: 'unsupported-stat',
        runeId: rune.id || '',
        runeName: rune.name || '',
        line,
        message: `${rune.name || '自定义铭文'}：“${stat}”不是支持的属性名，未猜测映射，也未计入合计。`,
      });
      continue;
    }
    if (unit !== expected) {
      issues.push({
        type: 'unit-mismatch',
        runeId: rune.id || '',
        runeName: rune.name || '',
        line,
        message: `${rune.name || '自定义铭文'}：“${line}”的单位与支持的格式不一致，未计入合计。`,
      });
      continue;
    }
    const sign = ['-', '−', '－'].includes(match[2]) ? '-' : '+';
    parts.push({
      stat,
      unit,
      value: decimal(match[3], sign),
      line,
    });
  }
  if (!parts.length && !issues.length) {
    issues.push({
      type: 'empty-effect',
      runeId: rune.id || '',
      runeName: rune.name || '',
      line: '',
      message: `${rune.name || '该铭文'}没有可计算的属性，未计入合计。`,
    });
  }
  return { parts, issues };
}

export function aggregateRuneStats(
  runeLibrary: CatalogItem[],
  runeCounts: Record<string, number>,
) {
  const issues: Issue[] = [];
  const grouped = new Map<
    string,
    { stat: string; unit: string; value: Decimal }
  >();
  const byId = new Map<string, CatalogItem>();
  const duplicateIds = new Set();
  for (const rune of Array.isArray(runeLibrary) ? runeLibrary : []) {
    if (!rune || typeof rune.id !== 'string') continue;
    if (byId.has(rune.id)) duplicateIds.add(rune.id);
    else byId.set(rune.id, rune);
  }
  let runeTotal = 0;
  for (const [runeId, count] of Object.entries(runeCounts || {})) {
    if (!Number.isSafeInteger(count) || count < 1 || count > 10) {
      issues.push({
        type: 'invalid-count',
        runeId,
        runeName: byId.get(runeId)?.name || '',
        line: '',
        message: `铭文 ${runeId} 的数量不是1至10的整数，整条未计入合计。`,
      });
      continue;
    }
    if (duplicateIds.has(runeId)) {
      issues.push({
        type: 'ambiguous-rune',
        runeId,
        runeName: '',
        line: '',
        message: `编号 ${runeId} 对应多条铭文，无法确定属性，整条未计入合计。`,
      });
      continue;
    }
    const rune = byId.get(runeId);
    if (!rune) {
      issues.push({
        type: 'missing-rune',
        runeId,
        runeName: '',
        line: '',
        message: `未找到编号 ${runeId} 的铭文资料，整条未计入合计。`,
      });
      continue;
    }
    runeTotal += count;
    const parsed = parseRuneEffect(rune.effect, rune);
    issues.push(...parsed.issues);
    for (const part of parsed.parts) {
      const key = `${part.stat}\u0000${part.unit}`;
      const current = grouped.get(key);
      const contribution = multiply(part.value, count);
      grouped.set(key, {
        stat: part.stat,
        unit: part.unit,
        value: current ? add(current.value, contribution) : contribution,
      });
    }
  }
  const totals = [...grouped.values()].map((entry) => {
    const value = formatDecimal(entry.value);
    const signed = value.startsWith('-') ? value : `+${value}`;
    return {
      stat: entry.stat,
      unit: entry.unit,
      value,
      display: `${entry.stat}${signed}${entry.unit === 'percent' ? '%' : ''}`,
    };
  });
  return { totals, issues, runeTotal, complete: issues.length === 0 };
}
