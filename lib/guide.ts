import official from '@/data/official.json';
import heroTalentData from '@/data/hero-talents.json';
import { validateCatalog, catalogImage, type CatalogItem } from './catalog';
import { heroTiers } from './tiers';
export const heroes = official.heroes;
export type Hero = (typeof heroes)[number];
export const MAX_SELECTED_TALENTS_PER_SKILL = 6;
export const priorities = {
  core: '核心必选',
  recommended: '优先推荐',
  situational: '视情况选择',
  avoid: '不推荐',
  selected: '已选',
  none: '未评价',
} as const;
export type Priority = keyof typeof priorities;
export type Talent = {
  id: string;
  name: string;
  description: string;
  skill?: number;
  source?: string;
};
export type CoreTalent = {
  id: string;
  name: string;
  description: string;
  skill: number;
  source?: string;
};
type HeroTalentPreset = {
  heroId: string;
  heroName: string;
  source: string;
  talents: Talent[];
  cores: CoreTalent[];
};
const heroTalentPresets = heroTalentData as HeroTalentPreset[];
export function heroTalentPreset(heroId: string) {
  return heroTalentPresets.find((entry) => entry.heroId === heroId);
}
export type Pick = { talentId: string; priority: Priority; reason: string };
export type Glyph = CatalogItem;
export type Build = {
  id: string;
  name: string;
  summary: string;
  order: string;
  picks: Pick[];
  glyphs: string;
  runes: string;
  arcana: string;
  notes: string;
  coreIds: string[];
  glyphIds: string[];
  talentIds: string[];
  runeIds: string[];
  runeCounts: Record<string, number>;
};
export type Guide = {
  heroId: string;
  tier?: string;
  tierReason?: string;
  notes?: string;
  title: string;
  intro: string;
  version: string;
  author: string;
  source: string;
  verified: boolean;
  talents: Talent[];
  builds: Build[];
  glyphs: Glyph[];
  cores: CoreTalent[];
  runeLibrary: CatalogItem[];
};
export type GuideRecord = {
  heroId: string;
  revision: number;
  updatedAt: string;
  publishedAt: string | null;
  published: Guide | null;
  draft?: Guide;
};
export type Access = {
  signedIn: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  displayName: string;
};
export function blankBuild(): Build {
  return {
    id: crypto.randomUUID(),
    name: '',
    summary: '',
    order: '',
    picks: [],
    glyphs: '',
    runes: '',
    arcana: '',
    notes: '',
    coreIds: [],
    glyphIds: [],
    talentIds: [],
    runeIds: [],
    runeCounts: {},
  };
}
export function blankGuide(heroId = ''): Guide {
  const preset = heroTalentPreset(heroId);
  return {
    heroId,
    title: '',
    intro: '',
    version: '',
    author: '',
    source: preset?.source || '',
    verified: false,
    talents: Array.from({ length: 24 }, (_, i) => ({
      id: `t${String(i + 1).padStart(2, '0')}`,
      name: '',
      description: '',
      skill: Math.floor(i / 8) + 1,
      ...preset?.talents.find(
        (t) => t.id === `t${String(i + 1).padStart(2, '0')}`,
      ),
    })),
    builds: [blankBuild()],
    glyphs: [],
    runeLibrary: [],
    cores: Array.from({ length: 6 }, (_, i) => ({
      id: `c${i + 1}`,
      skill: Math.floor(i / 2) + 1,
      name: '',
      description: '',
      ...preset?.cores.find((c) => c.id === `c${i + 1}`),
    })),
  };
}
function value(v: unknown, max: number, label: string): string {
  if (typeof v !== 'string' || v.length > max)
    throw new Error(`${label}格式不正确或超出${max}字`);
  return v.trim();
}
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('攻略格式不正确');
  return v as Record<string, unknown>;
}
export function validateGuide(input: unknown, publish = false): Guide {
  const d = obj(input);
  const heroId = value(d.heroId, 20, '英雄');
  if (!heroes.some((h) => h.id === heroId)) throw new Error('请从目录选择英雄');
  if (
    !Array.isArray(d.talents) ||
    d.talents.length < 1 ||
    d.talents.length > 36
  )
    throw new Error('请录入1至36个小天赋栏位');
  const talents = d.talents.map((v, i) => {
    const t = obj(v);
    if (t.id !== `t${String(i + 1).padStart(2, '0')}`)
      throw new Error('天赋编号或顺序不正确');
    return {
      id: String(t.id),
      name: value(t.name, 60, '天赋名称'),
      description: value(t.description, 1600, '天赋效果'),
      skill: [1, 2, 3].includes(Number(t.skill)) ? Number(t.skill) : undefined,
      source: value(t.source || '', 400, '天赋来源'),
    };
  });
  const names = talents.map((t) => t.name).filter(Boolean);
  const skillNames = talents
    .filter((t) => t.name)
    .map((t) => `${t.skill || 0}:${t.name}`);
  if (new Set(skillNames).size !== skillNames.length)
    throw new Error('同一技能的天赋名称重复，请检查');
  if (!Array.isArray(d.builds) || d.builds.length < 1 || d.builds.length > 8)
    throw new Error('请保留1至8个核心流派');
  const builds = d.builds.map((v) => {
    const b = obj(v);
    const rawPicks = b.picks || [];
    if (!Array.isArray(rawPicks) || rawPicks.length > talents.length)
      throw new Error('天赋说明数量不正确');
    const picks = rawPicks.map((v) => {
      const p = obj(v);
      if (
        typeof p.priority !== 'string' ||
        !Object.hasOwn(priorities, p.priority)
      )
        throw new Error('推荐等级不正确');
      const t = talents.find((t) => t.id === p.talentId);
      if (!t) throw new Error('天赋编号不存在');
      const reason = value(p.reason, 1200, '选择理由');
      return { talentId: t.id, priority: p.priority as Priority, reason };
    });
    if (new Set(picks.map((p) => p.talentId)).size !== picks.length)
      throw new Error('同一流派存在重复天赋');
    const runeIds = ids(b.runeIds, '铭文选择', 30);
    const runeCounts = quantities(b.runeCounts, runeIds);
    const build = {
      id: value(b.id, 80, '流派编号'),
      name: value(b.name, 70, '流派名称'),
      summary: value(b.summary, 2000, '流派思路'),
      order: value(b.order, 2000, '选择顺序'),
      picks,
      glyphs: value(b.glyphs, 3000, '雕文搭配'),
      runes: value(b.runes, 2000, '铭文搭配'),
      arcana: value(b.arcana, 2000, '秘法'),
      notes: value(b.notes, 8000, '实战攻略'),
      coreIds: ids(b.coreIds, '核心选择', 12),
      glyphIds: ids(b.glyphIds, '雕文选择（最多6个）', 6),
      runeIds,
      runeCounts,
      talentIds: ids(
        b.talentIds === undefined
          ? picks
              .filter((p) => p.priority === 'selected')
              .map((p) => p.talentId)
          : b.talentIds,
        '小天赋选择',
        talents.length,
      ),
    };
    if (build.talentIds.some((id) => !talents.some((t) => t.id === id)))
      throw new Error('选择的天赋不存在');
    for (const skill of [0, 1, 2, 3]) {
      if (
        talents.filter(
          (t) => (t.skill || 0) === skill && build.talentIds.includes(t.id),
        ).length > MAX_SELECTED_TALENTS_PER_SKILL
      )
        throw new Error(
          `${['未分组', '一技能', '二技能', '三技能'][skill]}最多选择6个小天赋，请先取消该技能的一个已选天赋。各技能分别计算。`,
        );
    }
    if (
      publish &&
      build.talentIds.some((id) => {
        const t = talents.find((t) => t.id === id)!;
        return !t.name || !t.description;
      })
    )
      throw new Error('已选天赋需要名称与效果');
    if (!build.id) throw new Error('流派编号不能为空');
    if (publish && (!build.name || !build.summary || !build.talentIds.length))
      throw new Error('发布前每个流派需填写名称、思路，并选择至少一个天赋');
    return build;
  });
  if (new Set(builds.map((b) => b.id)).size !== builds.length)
    throw new Error('流派编号重复');
  const rawGlyphs = d.glyphs || [];
  if (!Array.isArray(rawGlyphs) || rawGlyphs.length > 240)
    throw new Error('雕文介绍最多240条');
  const glyphs = rawGlyphs.map((v) => {
    const g = obj(v);
    const glyph = {
      id: value(g.id, 80, '雕文编号'),
      name: value(g.name, 60, '雕文名称'),
      effect: value(g.effect, 2500, '雕文效果'),
      usage: value(g.usage, 2500, '雕文用法'),
      source: value(g.source || '', 500, '雕文来源'),
      color: value(g.color || '', 30, '雕文类别'),
      icon: catalogImage(g.icon),
      image: catalogImage(g.image),
    };
    if (!glyph.id) throw new Error('雕文编号不能为空');
    if (publish && (!glyph.name || !glyph.effect))
      throw new Error('发布前请填写雕文名称与效果，或移除空白雕文');
    return glyph;
  });
  if (new Set(glyphs.map((g) => g.id)).size !== glyphs.length)
    throw new Error('雕文编号重复');
  const rawCores = d.cores || [];
  if (!Array.isArray(rawCores) || rawCores.length > 12)
    throw new Error('流派核心数量不正确');
  const cores = rawCores.map((v) => {
    const c = obj(v);
    if (![1, 2, 3].includes(Number(c.skill)))
      throw new Error('核心所属技能不正确');
    return {
      id: value(c.id, 80, '核心编号'),
      name: value(c.name, 60, '核心名称'),
      description: value(c.description, 2000, '核心效果'),
      skill: Number(c.skill),
      source: value(c.source || '', 400, '核心来源'),
    };
  });
  if (
    cores.some((c) => !c.id) ||
    new Set(cores.map((c) => c.id)).size !== cores.length
  )
    throw new Error('核心编号缺失或重复');
  const runeLibrary = validateCatalog(d.runeLibrary || []);
  for (const b of builds) {
    if (b.coreIds.some((id) => !cores.some((c) => c.id === id)))
      throw new Error('选择的核心不存在');
    if (
      new Set(b.coreIds.map((id) => cores.find((c) => c.id === id)!.skill))
        .size !== b.coreIds.length
    )
      throw new Error('同一技能只能选择一个核心');
    if (b.glyphIds.some((id) => !glyphs.some((g) => g.id === id)))
      throw new Error('选择的雕文不存在');
    if (b.runeIds.some((id) => !runeLibrary.some((r) => r.id === id)))
      throw new Error('选择的铭文不存在');
    if (
      b.runeIds.some(
        (id) =>
          !['红色', '蓝色', '绿色'].includes(
            runeLibrary.find((r) => r.id === id)!.color || '',
          ),
      )
    )
      throw new Error('已选铭文必须指定红色、蓝色或绿色');
    if (Object.values(b.runeCounts).reduce((a, n) => a + n, 0) > 30)
      throw new Error('铭文总数不能超过30枚');
    for (const color of ['红色', '蓝色', '绿色'])
      if (
        b.runeIds
          .filter((id) => runeLibrary.find((r) => r.id === id)?.color === color)
          .reduce((a, id) => a + b.runeCounts[id], 0) > 10
      )
        throw new Error(`${color}铭文不能超过10枚`);
    if (
      publish &&
      b.coreIds.some((id) => {
        const c = cores.find((c) => c.id === id)!;
        return !c.name || !c.description;
      })
    )
      throw new Error('已选核心需要名称与效果');
  }
  const guide = {
    heroId,
    tier: value(d.tier || '', 12, '英雄梯度'),
    tierReason: value(d.tierReason || '', 2000, '英雄评级理由'),
    notes: value(d.notes || '', 12000, '英雄攻略备注'),
    title: value(d.title, 100, '攻略标题'),
    intro: value(d.intro, 2400, '简介'),
    version: value(d.version, 80, '游戏版本'),
    author: value(d.author, 60, '作者署名'),
    source: value(d.source, 3000, '资料来源'),
    verified: d.verified === true,
    talents,
    builds,
    glyphs,
    cores,
    runeLibrary,
  };
  if (guide.tier && !heroTiers.some((tier) => tier === guide.tier))
    throw new Error('请选择有效的英雄梯度');
  if (publish && (!guide.title || !guide.version || !guide.author))
    throw new Error('发布前请填写标题、游戏版本和作者署名');
  if (
    publish &&
    guide.verified &&
    (names.length !== talents.length ||
      talents.some((t) => !t.description) ||
      cores.length !== 6 ||
      [1, 2, 3].some(
        (skill) => cores.filter((c) => c.skill === skill).length !== 2,
      ) ||
      cores.some((c) => !c.name || !c.description) ||
      !guide.source)
  )
    throw new Error(
      '标记已核验需补齐6个核心（每技能2个）、全部天赋名称与效果，并填写核验来源',
    );
  return guide;
}
export function selectedTalents(build: Build): string[] {
  return Array.from(
    new Set(
      build.talentIds ??
        (build.picks || [])
          .filter((p) => p.priority === 'selected')
          .map((p) => p.talentId),
    ),
  );
}
export function chooseTalent(
  build: Build,
  talentId: string,
  checked: boolean,
  talents: Talent[],
): Partial<Build> {
  const target = talents.find((t) => t.id === talentId);
  if (!target) throw new Error('找不到这个小天赋');
  const rest = selectedTalents(build).filter((id) => id !== talentId);
  const selectedInSkill = talents.filter(
    (t) => (t.skill || 0) === (target.skill || 0) && rest.includes(t.id),
  ).length;
  if (checked && selectedInSkill >= MAX_SELECTED_TALENTS_PER_SKILL)
    throw new Error(
      '本技能的6个小天赋已选满，请先取消本技能的一项再选择。其他技能的选择不占用这里的名额。',
    );
  return {
    talentIds: checked ? [...rest, talentId] : rest,
    // A manual change is no longer the original screenshot selection.
    picks: (build.picks || []).map((p) =>
      p.talentId === talentId && p.priority === 'selected'
        ? { ...p, priority: 'none', reason: '' }
        : p,
    ),
  };
}
function ids(v: unknown, label: string, max: number): string[] {
  if (v === undefined) return [];
  if (
    !Array.isArray(v) ||
    v.length > max ||
    v.some((x) => typeof x !== 'string' || x.length > 80) ||
    new Set(v).size !== v.length
  )
    throw new Error(`${label}格式不正确`);
  return v;
}
function quantities(v: unknown, selected: string[]): Record<string, number> {
  const input = v === undefined ? {} : obj(v);
  if (Object.keys(input).some((id) => !selected.includes(id)))
    throw new Error('铭文数量含未选择的条目');
  return Object.fromEntries(
    selected.map((id) => {
      const count = Object.hasOwn(input, id) ? input[id] : 1;
      if (
        !Number.isSafeInteger(count) ||
        Number(count) < 1 ||
        Number(count) > 10
      )
        throw new Error('每种铭文数量须为1至10枚');
      return [id, Number(count)];
    }),
  );
}
