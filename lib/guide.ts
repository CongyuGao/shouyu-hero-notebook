import official from '@/data/official.json';
export const heroes = official.heroes;
export type Hero = (typeof heroes)[number];
export const priorities = {
  core: '核心必选',
  recommended: '优先推荐',
  situational: '视情况选择',
  avoid: '不推荐',
  none: '未评价',
} as const;
export type Priority = keyof typeof priorities;
export type Talent = { id: string; name: string; description: string };
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
    talents: Array.from({ length: 18 }, (_, i) => ({
      id: `t${String(i + 1).padStart(2, '0')}`,
      name: '',
      description: '',
    })),
    builds: [blankBuild()],
    glyphs: [],
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
  if (!Array.isArray(d.talents) || d.talents.length !== 18)
    throw new Error('每位英雄需要18个小天赋栏位');
  const talents = d.talents.map((v, i) => {
    const t = obj(v);
    if (t.id !== `t${String(i + 1).padStart(2, '0')}`)
      throw new Error('天赋编号或顺序不正确');
    return {
      id: String(t.id),
      name: value(t.name, 60, '天赋名称'),
      description: value(t.description, 1600, '天赋效果'),
    };
  });
  const names = talents.map((t) => t.name).filter(Boolean);
  if (new Set(names).size !== names.length)
    throw new Error('天赋名称重复，请检查');
  if (!Array.isArray(d.builds) || d.builds.length < 1 || d.builds.length > 8)
    throw new Error('请保留1至8个核心流派');
  const builds = d.builds.map((v) => {
    const b = obj(v);
    if (!Array.isArray(b.picks) || b.picks.length > 18)
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
    };
    if (!build.id) throw new Error('流派编号不能为空');
    if (
      publish &&
      (!build.name ||
        !build.summary ||
        !picks.some(
          (p) => p.priority === 'core' || p.priority === 'recommended',
        ))
    )
      throw new Error('发布前每个流派需填写名称、思路及至少一个必选或推荐天赋');
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
  };
  if (publish && (!guide.title || !guide.version || !guide.author))
    throw new Error('发布前请填写标题、游戏版本和作者署名');
  if (
    publish &&
    guide.verified &&
    (names.length !== 18 ||
      talents.some((t) => !t.description) ||
      !guide.source)
  )
    throw new Error('标记已核验需补齐18个天赋名称与效果，并填写核验来源');
  return guide;
}
