import official from '@/data/official.json';
export const heroes = official.heroes;
export type Hero = (typeof heroes)[number];
export const priorities = {
  core: '核心必选',
  recommended: '优先推荐',
  situational: '视情况选择',
  avoid: '不推荐',
  selected: '截图已选',
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
export type Pick = { talentId: string; priority: Priority; reason: string };
export type Glyph = { id: string; name: string; effect: string; usage: string };
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
};
export type Guide = {
  heroId: string;
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
  };
}
export function blankGuide(heroId = ''): Guide {
  return {
    heroId,
    title: '',
    intro: '',
    version: '',
    author: '',
    source: '',
    verified: false,
    talents: Array.from({ length: 24 }, (_, i) => ({
      id: `t${String(i + 1).padStart(2, '0')}`,
      name: '',
      description: '',
      skill: Math.floor(i / 8) + 1,
    })),
    builds: [blankBuild()],
    glyphs: [],
    cores: Array.from({ length: 6 }, (_, i) => ({
      id: `c${i + 1}`,
      skill: Math.floor(i / 2) + 1,
      name: '',
      description: '',
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
    throw new Error('请录入1至36个小天赋栏位，数量以当前游戏截图为准');
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
  if (new Set(names).size !== names.length)
    throw new Error('天赋名称重复，请检查');
  if (!Array.isArray(d.builds) || d.builds.length < 1 || d.builds.length > 8)
    throw new Error('请保留1至8个核心流派');
  const builds = d.builds.map((v) => {
    const b = obj(v);
    if (!Array.isArray(b.picks) || b.picks.length > talents.length)
      throw new Error('天赋推荐数量不正确');
    const picks = b.picks.map((v) => {
      const p = obj(v);
      if (
        typeof p.priority !== 'string' ||
        !Object.hasOwn(priorities, p.priority)
      )
        throw new Error('推荐等级不正确');
      const t = talents.find((t) => t.id === p.talentId);
      if (!t) throw new Error('天赋编号不存在');
      const reason = value(p.reason, 1200, '选择理由');
      if (publish && p.priority !== 'none' && (!t.name || !reason))
        throw new Error('已评价天赋需要名称和选择理由');
      return { talentId: t.id, priority: p.priority as Priority, reason };
    });
    if (new Set(picks.map((p) => p.talentId)).size !== picks.length)
      throw new Error('同一流派存在重复天赋');
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
      glyphIds: ids(b.glyphIds, '雕文选择', 36),
    };
    if (!build.id) throw new Error('流派编号不能为空');
    if (
      publish &&
      (!build.name ||
        !build.summary ||
        !picks.some(
          (p) =>
            p.priority === 'core' ||
            p.priority === 'recommended' ||
            p.priority === 'selected',
        ))
    )
      throw new Error(
        '发布前每个流派需填写名称、思路及至少一个推荐或截图已选天赋',
      );
    return build;
  });
  if (new Set(builds.map((b) => b.id)).size !== builds.length)
    throw new Error('流派编号重复');
  const rawGlyphs = d.glyphs || [];
  if (!Array.isArray(rawGlyphs) || rawGlyphs.length > 36)
    throw new Error('雕文介绍最多36条');
  const glyphs = rawGlyphs.map((v) => {
    const g = obj(v);
    const glyph = {
      id: value(g.id, 80, '雕文编号'),
      name: value(g.name, 60, '雕文名称'),
      effect: value(g.effect, 2500, '雕文效果'),
      usage: value(g.usage, 2500, '雕文用法'),
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
  };
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
