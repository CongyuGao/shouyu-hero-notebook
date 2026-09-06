import initial from '@/data/initial-roster.json';
import official from '@/data/official.json';

export type HeroBatch = { id: string; name: string; heroIds: string[] };
export type ModeRoster = {
  revision: number;
  intro: string;
  groups: HeroBatch[];
};
export function rosterHeroIds(roster: Pick<ModeRoster, 'groups'>) {
  return roster.groups.flatMap((g) => g.heroIds);
}
export function validateRoster(input: unknown): Omit<ModeRoster, 'revision'> {
  const value = input as Partial<ModeRoster>;
  if (!value || !Array.isArray(value.groups) || value.groups.length !== 3)
    throw new Error('请保留三个轮换批次');
  if (typeof value.intro !== 'string' || value.intro.length > 1000)
    throw new Error('轮换说明最多1000字');
  const known = new Set(official.heroes.map((h) => h.id));
  const groups = value.groups.map((g) => {
    if (!g || typeof g.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(g.id))
      throw new Error('批次编号无效');
    if (typeof g.name !== 'string' || !g.name.trim() || g.name.length > 40)
      throw new Error('请填写批次名称（最多40字）');
    if (
      !Array.isArray(g.heroIds) ||
      !g.heroIds.length ||
      g.heroIds.length > 30 ||
      g.heroIds.some((id) => typeof id !== 'string' || !known.has(id))
    )
      throw new Error('每批请保留1至30位目录中存在的英雄');
    return { id: g.id, name: g.name.trim(), heroIds: [...g.heroIds] };
  });
  const ids = rosterHeroIds({ groups });
  if (
    new Set(groups.map((g) => g.id)).size !== 3 ||
    new Set(ids).size !== ids.length
  )
    throw new Error('批次编号不能重复，同一英雄只能属于一个批次');
  return { intro: value.intro.trim(), groups };
}
export const initialRoster: ModeRoster = {
  ...validateRoster(initial),
  revision: 0,
};
