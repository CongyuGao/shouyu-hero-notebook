import {
  heroes,
  heroSkills,
  skillLabels,
  selectedTalents,
  type GuideRecord,
} from './guide';
import { glyphGrade, type CatalogItem } from './catalog';
import { aggregateRuneStats } from './rune-stats';

export type ExportChoice = {
  name: string;
  selected: boolean;
  effect?: string;
  color?: string;
  image?: string;
  cardImage?: boolean;
};
export type ExportSection = {
  title: string;
  subtitle?: string;
  kind: 'choices' | 'glyphs' | 'text' | 'runes';
  choices?: ExportChoice[];
  text?: string;
  accent?: string;
  breakBefore?: boolean;
};
export type GuideExport = {
  heroName: string;
  avatar: string;
  buildName: string;
  publishedDate: string;
  version: string;
  tier: string;
  author: string;
  publicUrl: string;
  sections: ExportSection[];
};

// Export only the published snapshot, never an open editor or a live catalog.
export function createGuideExport(
  record: Pick<GuideRecord, 'published' | 'publishedAt'>,
  buildId: string,
  origin: string,
  includeEffects = false,
): GuideExport {
  const guide = record.published;
  if (
    !guide ||
    !record.publishedAt ||
    !Number.isFinite(Date.parse(record.publishedAt))
  )
    throw new Error('请先发布攻略，再导出分享图片。草稿不会被导出。');
  const build = guide.builds.find((item) => item.id === buildId);
  const hero = heroes.find((item) => item.id === guide.heroId);
  if (!build || !hero) throw new Error('请先选择一个已发布的流派。');
  const address = new URL(origin);
  if (!['https:', 'http:'].includes(address.protocol))
    throw new Error('网站地址无效');
  const publicUrl = new URL('/', address.origin);
  publicUrl.searchParams.set('hero', guide.heroId);
  publicUrl.searchParams.set('build', build.id);
  const talentIds = selectedTalents(build);
  const sections: ExportSection[] = [];
  const skillNames = skillLabels;
  const accents = ['#c5b8ed', '#e9c581', '#83c8ff', '#84e0cd', '#d4b0ff'];
  const groups = [
    ...heroSkills(guide.heroId),
    ...(guide.talents.some((t) => !t.skill) ? [0] : []),
  ];
  for (const skill of groups) {
    const cores = guide.cores.filter((c) => (c.skill || 0) === skill);
    const talents = guide.talents.filter((t) => (t.skill || 0) === skill);
    sections.push({
      title: `${skillNames[skill]} · 核心`,
      subtitle: `已选 ${cores.filter((c) => build.coreIds.includes(c.id)).length} / 1`,
      kind: 'choices',
      accent: accents[skill],
      // Mark skill boundaries so the renderer can keep each group together.
      breakBefore: true,
      choices: cores.map((c, index) => ({
        name: c.name || `核心 ${index + 1} · 待补充`,
        selected: build.coreIds.includes(c.id),
      })),
    });
    sections.push({
      title: `${skillNames[skill]} · 小天赋`,
      subtitle: `已选 ${talents.filter((t) => talentIds.includes(t.id)).length} / 6`,
      kind: 'choices',
      accent: accents[skill],
      choices: talents.map((t, index) => ({
        name: t.name || `天赋 ${index + 1} · 待补充`,
        selected: talentIds.includes(t.id),
      })),
    });
  }
  const chosenGlyphs = build.glyphIds.map((id) =>
    guide.glyphs.find((g) => g.id === id),
  );
  sections.push({
    title: '雕文搭配',
    subtitle: `已选 ${build.glyphIds.length} / 6`,
    kind: 'glyphs',
    breakBefore: true,
    accent: '#e9c581',
    choices: Array.from({ length: 6 }, (_, index) => {
      const g = chosenGlyphs[index];
      return {
        name: g?.name || (build.glyphIds[index] ? '资料缺失' : '未选择'),
        selected: !!build.glyphIds[index],
        effect: g ? glyphGrade(g.color) : '',
        image: g?.icon || g?.image,
        cardImage: !g?.icon,
      };
    }),
  });
  const counts = Object.fromEntries(
    build.runeIds.map((id) => [id, build.runeCounts?.[id] ?? 1]),
  );
  const stats = aggregateRuneStats(guide.runeLibrary, counts);
  sections.push({
    title: '五级铭文',
    subtitle: `${stats.runeTotal} / 30 枚`,
    kind: 'runes',
    choices: build.runeIds.map((id) => {
      const r = guide.runeLibrary.find((item) => item.id === id);
      return {
        name: `${r?.name || '资料缺失'} × ${counts[id]}`,
        selected: true,
        color: r?.color,
        effect: r?.color || '颜色待核对',
      };
    }),
  });
  if (stats.totals.length)
    sections.push({
      title: stats.complete ? '铭文属性合计' : '铭文属性合计 · 不完整',
      kind: 'text',
      text: stats.totals.map((s) => s.display).join('\n'),
      accent: '#84e0cd',
    });
  if (stats.issues.length)
    sections.push({
      title: '属性核对提醒',
      kind: 'text',
      accent: '#f7b88e',
      text: stats.issues.map((i) => i.message).join('\n'),
    });
  if (includeEffects) {
    function detail(title: string, text?: string, accent = '#c6d7ef') {
      if (text?.trim()) sections.push({ title, kind: 'text', text, accent });
    }
    const detailStart = sections.length;
    detail('流派思路', build.summary);
    detail('天赋选择顺序', build.order);
    for (const skill of groups) {
      for (const c of guide.cores.filter(
        (c) => (c.skill || 0) === skill && build.coreIds.includes(c.id),
      ))
        detail(
          `${skillNames[skill]} · 核心 · ${c.name || '待补充'}`,
          c.description || '效果待补充',
          accents[skill],
        );
      for (const t of guide.talents.filter(
        (t) => (t.skill || 0) === skill && talentIds.includes(t.id),
      )) {
        const pick = build.picks.find((p) => p.talentId === t.id);
        detail(
          `${skillNames[skill]} · ${t.name || '待补充'}`,
          t.description || '效果待补充',
          accents[skill],
        );
        if (pick?.priority !== 'selected')
          detail(`${t.name} · 选择说明`, pick?.reason);
      }
    }
    function itemDetail(item: CatalogItem | undefined, title: string) {
      if (!item) {
        detail(title, '所选条目的资料缺失，请在网站核对。');
        return;
      }
      detail(title, item.effect || '效果待补充', '#e9c581');
      detail(`${item.name} · 搭配说明`, item.usage);
    }
    chosenGlyphs.forEach((g, i) =>
      itemDetail(g, `雕文 · ${g?.name || `第 ${i + 1} 项`}`),
    );
    build.runeIds.forEach((id) => {
      const r = guide.runeLibrary.find((item) => item.id === id);
      itemDetail(
        r,
        `铭文 · ${r?.name || id} × ${counts[id]}（以下为单枚属性）`,
      );
    });
    detail('雕文搭配说明', build.glyphs);
    detail('铭文搭配说明', build.runes);
    detail('秘法', build.arcana);
    detail('本流派 · 打法与备注', build.notes);
    detail('英雄通用说明', guide.notes);
    if (sections[detailStart]) sections[detailStart].breakBefore = true;
  }
  return {
    heroName: hero.name,
    avatar: hero.avatar,
    buildName: build.name || `流派 ${guide.builds.indexOf(build) + 1}`,
    publishedDate: new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Shanghai',
    }).format(new Date(record.publishedAt)),
    version: guide.version,
    tier: guide.tier || '',
    author: guide.author,
    publicUrl: publicUrl.toString(),
    sections,
  };
}
