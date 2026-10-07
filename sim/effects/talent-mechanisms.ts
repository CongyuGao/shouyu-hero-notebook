// Talent and core mechanism sheets, one JSON file per hero under
// sim/effects/talent-mechanisms/<heroId>.json.
//
// A sheet records what each talent does according to its in-game text, which
// numbers the simulator will need, and which of those the text already claims.
// Claimed numbers are description values: known to differ from actual values
// in several cases, so they load as unverified Params. Slots with no claimed
// number load as MissingParam until pack data fills them.

import heroTalents from '../../data/hero-talents.json' with { type: 'json' };
import initialGuides from '../../data/initial-guides.json' with { type: 'json' };
import roster from '../../data/initial-roster.json' with { type: 'json' };
import official from '../../data/official.json' with { type: 'json' };
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { param } from '../core/param.ts';
import type { MissingParam, Param, ParamUnit } from '../core/types.ts';

export const MECHANISM_KINDS = [
  'stat', // permanent stat change
  'buff', // timed stat change on a trigger
  'stacking', // effect that builds up in stacks
  'proc', // extra damage instance
  'damage-amp', // damage multiplier
  'true-damage',
  'max-hp-damage', // damage based on target max HP
  'execute',
  'crit',
  'cooldown',
  'charges', // extra casts or stored uses
  'conversion', // one stat converted into another
  'skill-change', // skill behavior replaced
  'area', // range, radius, distance or projectile count
  'summon', // clones, fields, projectiles that act on their own
  'shield',
  'heal',
  'lifesteal',
  'damage-reduction',
  'control', // stun, slow, knock-up, fear, pull
  'control-immunity', // tenacity, block control, unstoppable
  'mobility', // move speed, dash, terrain passing
  'invulnerable', // untargetable, invincible, stealth, dodge
  'revive',
  'economy', // gold, experience
  'team', // affects allies
  'other',
] as const;
export type MechanismKind = (typeof MECHANISM_KINDS)[number];

export const SLOT_UNITS: readonly ParamUnit[] = [
  'flat',
  'percent',
  'ratio',
  'seconds',
  'frames',
  'count',
  'meters',
];

export type ClaimedValue = {
  value: number;
  // Exact substring of the talent text that contains the number
  quote: string;
};

export type MechanismSlot = {
  key: string;
  what: string;
  unit: ParamUnit;
  claimed: ClaimedValue | null;
  // What to look for in the resource pack
  packHint: string;
};

export type MechanismItem = {
  id: string;
  kind: 'core' | 'talent';
  skill: number;
  name: string;
  text: string;
  reading: string;
  mechanisms: MechanismKind[];
  damageRelevance: 'direct' | 'indirect' | 'none';
  trigger: string;
  slots: MechanismSlot[];
  ambiguities: string[];
  // Numbers in the text deliberately not used as a slot, with the reason
  unusedNumbers: Array<{ quote: string; reason: string }>;
  // Earlier findings that still need pack confirmation
  priorFindings: string[];
};

export type MechanismSheet = {
  heroId: string;
  heroName: string;
  source: string;
  items: MechanismItem[];
};

type SourceItem = {
  id: string;
  name: string;
  description: string;
  skill?: number;
};

export type SourceHero = {
  heroId: string;
  heroName: string;
  source: string;
  cores: SourceItem[];
  talents: SourceItem[];
};

const SHEET_DIR = new URL('./talent-mechanisms/', import.meta.url);

// Roster heroes in batch order. 亚瑟 has no preset in hero-talents.json; his
// talents come from his published guide in initial-guides.json.
export function rosterHeroIds(): string[] {
  return roster.groups.flatMap((g) => g.heroIds);
}

export function sourceHero(heroId: string): SourceHero {
  const preset = heroTalents.find((h) => h.heroId === heroId);
  if (preset)
    return {
      heroId,
      heroName: preset.heroName,
      source: 'data/hero-talents.json',
      cores: preset.cores,
      talents: preset.talents,
    };
  const guide = initialGuides.find((g) => g.heroId === heroId);
  if (guide)
    return {
      heroId,
      heroName: official.heroes.find((h) => h.id === heroId)?.name ?? heroId,
      source: 'data/initial-guides.json',
      cores: guide.cores,
      talents: guide.talents,
    };
  throw new Error(`没有英雄 ${heroId} 的天赋原文`);
}

// Numbers as written in Chinese talent text: 25%, -0.4, 1，2 etc.
const NUMBER = /\d+(?:\.\d+)?/g;

export function numbersIn(text: string): number[] {
  return [...text.matchAll(NUMBER)].map((m) => Number(m[0]));
}

export function validateSheet(sheet: MechanismSheet): string[] {
  const problems: string[] = [];
  let hero: SourceHero;
  try {
    hero = sourceHero(sheet.heroId);
  } catch (error) {
    return [String(error)];
  }
  if (sheet.heroName !== hero.heroName)
    problems.push(`英雄名应为 ${hero.heroName}`);
  if (sheet.source !== hero.source) problems.push(`source 应为 ${hero.source}`);
  const expected = [
    ...hero.cores.map((c) => ({ ...c, kind: 'core' as const })),
    ...hero.talents.map((t) => ({ ...t, kind: 'talent' as const })),
  ];
  const seen = new Set<string>();
  for (const item of sheet.items) {
    const at = `${item.id}`;
    if (seen.has(item.id)) problems.push(`${at}: 重复`);
    seen.add(item.id);
    const src = expected.find((e) => e.id === item.id);
    if (!src) {
      problems.push(`${at}: 原文里没有这个编号`);
      continue;
    }
    if (item.kind !== src.kind) problems.push(`${at}: kind 应为 ${src.kind}`);
    if (item.name !== src.name) problems.push(`${at}: 名称应为 ${src.name}`);
    if (item.text !== src.description)
      problems.push(`${at}: text 必须逐字等于原文描述`);
    if (src.skill !== undefined && item.skill !== src.skill)
      problems.push(`${at}: skill 应为 ${src.skill}`);
    if (!item.reading.trim()) problems.push(`${at}: reading 为空`);
    if (!item.mechanisms.length) problems.push(`${at}: mechanisms 为空`);
    for (const m of item.mechanisms)
      if (!(MECHANISM_KINDS as readonly string[]).includes(m))
        problems.push(`${at}: 未知机制类型 ${m}`);
    if (!['direct', 'indirect', 'none'].includes(item.damageRelevance))
      problems.push(`${at}: damageRelevance 无效`);
    const slotKeys = new Set<string>();
    const covered: number[] = [];
    for (const slot of item.slots) {
      if (slotKeys.has(slot.key)) problems.push(`${at}: 参数 ${slot.key} 重复`);
      slotKeys.add(slot.key);
      if (!SLOT_UNITS.includes(slot.unit))
        problems.push(`${at}/${slot.key}: 单位无效`);
      if (!slot.what.trim() || !slot.packHint.trim())
        problems.push(`${at}/${slot.key}: what 或 packHint 为空`);
      if (slot.claimed) {
        const { value, quote } = slot.claimed;
        if (!quote || !item.text.includes(quote))
          problems.push(`${at}/${slot.key}: quote 不是原文片段`);
        else if (!numbersIn(quote).includes(value))
          problems.push(`${at}/${slot.key}: 数值 ${value} 不在 quote 里`);
        covered.push(value);
      }
    }
    for (const unused of item.unusedNumbers) {
      if (!item.text.includes(unused.quote))
        problems.push(`${at}: unusedNumbers 的 quote 不是原文片段`);
      if (!unused.reason.trim()) problems.push(`${at}: unusedNumbers 缺少理由`);
      covered.push(...numbersIn(unused.quote));
    }
    for (const n of numbersIn(item.text))
      if (!covered.includes(n))
        problems.push(`${at}: 原文数字 ${n} 没有对应参数或 unusedNumbers`);
  }
  for (const e of expected)
    if (!seen.has(e.id)) problems.push(`${e.id}: 缺少条目`);
  return problems;
}

export function sheetPath(heroId: string): URL {
  return new URL(`${heroId}.json`, SHEET_DIR);
}

export function loadSheet(heroId: string): MechanismSheet | null {
  const path = sheetPath(heroId);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as MechanismSheet;
}

export type LoadedSlot = {
  slot: MechanismSlot;
  // Description value when the text states one; never verified
  claimed: Param | null;
  missing: MissingParam;
};

// Every slot needs a pack value. Claimed description values are returned
// alongside so reports can show them as unverified.
export function loadSlots(sheet: MechanismSheet, item: MechanismItem) {
  return item.slots.map((slot): LoadedSlot => {
    const ref = `${sheet.source}#${sheet.heroId}/${item.id}`;
    return {
      slot,
      claimed: slot.claimed
        ? param(slot.claimed.value, slot.unit, {
            kind: 'description',
            ref,
            note: `原文“${slot.claimed.quote}”`,
          })
        : null,
      missing: {
        key: `talent:${sheet.heroId}:${item.id}:${slot.key}`,
        what: `${sheet.heroName}「${item.name}」${slot.what}`,
        neededFor: slot.packHint,
      },
    };
  });
}

// CLI: node sim/effects/talent-mechanisms.ts [heroId ...]
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const ids = process.argv.slice(2);
  const targets = ids.length ? ids : rosterHeroIds();
  let failed = false;
  for (const id of targets) {
    const sheet = loadSheet(id);
    if (!sheet) {
      console.log(`${id}: 还没有机制表`);
      if (ids.length) failed = true;
      continue;
    }
    const problems = validateSheet(sheet);
    if (problems.length) {
      failed = true;
      console.log(`${id} ${sheet.heroName}: ${problems.length} 个问题`);
      for (const p of problems) console.log(`  - ${p}`);
    } else
      console.log(`${id} ${sheet.heroName}: 通过（${sheet.items.length} 条）`);
  }
  process.exitCode = failed ? 1 : 0;
}
