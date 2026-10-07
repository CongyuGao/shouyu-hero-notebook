// Renders the talent mechanism sheets as readable Markdown, one file per hero
// grouped by rotation batch, plus an index.
//
// node sim/reports/talent-report.ts

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import roster from '../../data/initial-roster.json' with { type: 'json' };
import official from '../../data/official.json' with { type: 'json' };
import {
  loadSheet,
  sourceHero,
  validateSheet,
  type MechanismItem,
  type MechanismKind,
  type MechanismSheet,
  type MechanismSlot,
} from '../effects/talent-mechanisms.ts';

const OUT = new URL('./talents/', import.meta.url);

const KIND_LABELS: Record<MechanismKind, string> = {
  stat: '常驻属性',
  buff: '限时增益',
  stacking: '叠层',
  proc: '额外伤害',
  'damage-amp': '增伤',
  'true-damage': '真实伤害',
  'max-hp-damage': '最大生命百分比伤害',
  execute: '斩杀',
  crit: '暴击',
  cooldown: '冷却',
  charges: '充能/次数',
  conversion: '属性转换',
  'skill-change': '技能变更',
  area: '范围/距离/数量',
  summon: '召唤/分身/领域',
  shield: '护盾',
  heal: '回复',
  lifesteal: '吸血',
  'damage-reduction': '减伤',
  control: '控制',
  'control-immunity': '抗控',
  mobility: '位移/移速',
  invulnerable: '无敌/不可选中/隐身',
  revive: '复活',
  economy: '金币/经验',
  team: '作用于队友',
  other: '其他',
};

const RELEVANCE_LABELS = {
  direct: '直接影响伤害',
  indirect: '间接影响输出',
  none: '不影响伤害',
} as const;

const SKILL_LABELS = ['被动', '一技能', '二技能', '三技能', '四技能'];

function unitText(slot: MechanismSlot): string {
  switch (slot.unit) {
    case 'percent':
      return '%';
    case 'seconds':
      return '秒';
    case 'meters':
      return '米';
    case 'frames':
      return '帧';
    case 'ratio':
      return '倍';
    default:
      return '';
  }
}

function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderItem(item: MechanismItem): string {
  const lines = [`#### ${item.name}`, '', `> 原文：${item.text}`, ''];
  lines.push(`**机制：** ${item.reading}`, '');
  lines.push(
    `**类型：** ${item.mechanisms.map((m) => KIND_LABELS[m]).join('、')} · ${RELEVANCE_LABELS[item.damageRelevance]} · 触发：${item.trigger}`,
    '',
  );
  if (item.slots.length) {
    lines.push('| 需要的数值 | 原文描述值 | 状态 |', '|---|---|---|');
    for (const slot of item.slots) {
      const claimed = slot.claimed
        ? `${slot.claimed.value}${unitText(slot)}（“${cell(slot.claimed.quote)}”）`
        : '原文未写';
      const status = slot.claimed ? '描述值，待资源包核对' : '缺，待资源包';
      lines.push(`| ${cell(slot.what)} | ${claimed} | ${status} |`);
    }
    lines.push('');
  }
  if (item.ambiguities.length)
    lines.push(
      `**原文没说清：** ${item.ambiguities.map((a) => a.replace(/[。；]$/, '')).join('；')}。`,
      '',
    );
  if (item.priorFindings.length)
    lines.push(
      '**之前实测（待资源包复核）：**',
      ...item.priorFindings.map((f) => `- ${f}`),
      '',
    );
  return lines.join('\n');
}

function renderHero(sheet: MechanismSheet, batch: string): string {
  const src = sourceHero(sheet.heroId);
  const items = sheet.items;
  const slots = items.flatMap((i) => i.slots);
  const claimed = slots.filter((s) => s.claimed).length;
  const direct = items.filter((i) => i.damageRelevance === 'direct');
  const skills = [...new Set(items.map((i) => i.skill))].sort((a, b) => a - b);
  const preset = src.source === 'data/hero-talents.json';
  const lines = [
    `# ${sheet.heroName}`,
    '',
    `${batch} · 核心 ${items.filter((i) => i.kind === 'core').length} 个、小天赋 ${items.filter((i) => i.kind === 'talent').length} 个`,
    '',
    `- **资料来源：** 游戏内天赋原文（${preset ? 'data/hero-talents.json' : '亚瑟已发布攻略 data/initial-guides.json'}）。机制解读只依据原文文字，没有补充原文以外的内容。`,
    `- **数值状态：** 模拟需要 ${slots.length} 个数值，原文写了 ${claimed} 个（描述值，未核实），其余 ${slots.length - claimed} 个要等资源包。之前实测发现马可波罗、虞姬有多处描述和实际不符，描述值只能当参考。`,
    `- **直接影响伤害的条目：** ${direct.length ? direct.map((i) => i.name).join('、') : '无'}`,
    '',
  ];
  for (const skill of skills) {
    lines.push(`## ${SKILL_LABELS[skill] ?? `技能${skill}`}`, '');
    const cores = items.filter((i) => i.skill === skill && i.kind === 'core');
    const talents = items.filter(
      (i) => i.skill === skill && i.kind === 'talent',
    );
    if (cores.length) {
      lines.push('### 核心（二选一）', '');
      for (const item of cores) lines.push(renderItem(item));
    }
    if (talents.length) {
      lines.push('### 小天赋', '');
      for (const item of talents) lines.push(renderItem(item));
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

const heroName = (id: string) =>
  official.heroes.find((h) => h.id === id)?.name ?? id;

export function writeTalentReports() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const index = [
    '# 42 位模式英雄天赋详解',
    '',
    '由 `node sim/reports/talent-report.ts` 从 `sim/effects/talent-mechanisms/` 生成，不要手改。',
    '',
    '每位英雄的核心和小天赋逐条列出原文、机制解读、需要的数值（原文写了的标为描述值）和原文没说清的地方。资源包到位前，表里的数字都是游戏内描述值，不是实测值。',
    '',
  ];
  const problems: string[] = [];
  for (const group of roster.groups) {
    const dir = new URL(`${group.name}/`, OUT);
    mkdirSync(dir, { recursive: true });
    index.push(`## ${group.name}`, '', '| 英雄 | 条目 | 数值（原文已写 / 需要） | 状态 |', '|---|---|---|---|');
    group.heroIds.forEach((id, i) => {
      const name = heroName(id);
      const sheet = loadSheet(id);
      const issues = sheet ? validateSheet(sheet) : [];
      if (!sheet || issues.length) {
        if (issues.length) problems.push(`${name}: ${issues.length} 个问题`);
        index.push(`| ${name} | — | — | ${sheet ? '校验未通过' : '待生成'} |`);
        return;
      }
      const file = `${String(i + 1).padStart(2, '0')}-${name}.md`;
      writeFileSync(new URL(file, dir), renderHero(sheet, group.name));
      const slots = sheet.items.flatMap((it) => it.slots);
      index.push(
        `| [${name}](${encodeURI(`${group.name}/${file}`)}) | ${sheet.items.length} | ${slots.filter((s) => s.claimed).length} / ${slots.length} | 已生成 |`,
      );
    });
    index.push('');
  }
  writeFileSync(new URL('README.md', OUT), `${index.join('\n').trimEnd()}\n`);
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = writeTalentReports();
  for (const p of problems) console.log(`校验未通过：${p}`);
  console.log(`已生成到 ${OUT.pathname}`);
}
