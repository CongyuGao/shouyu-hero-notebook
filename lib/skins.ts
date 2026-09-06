import catalog from '@/data/hero-skins.json';

export type HeroSkin = {
  id: string;
  heroId: string;
  heroName: string;
  name: string;
  labels: string[];
  image: string;
  thumbnail: string;
  avatar: string;
  source: string;
};
export const heroSkins = catalog as HeroSkin[];
export function findHeroSkin(id?: string, heroId?: string) {
  return heroSkins.find(
    (skin) => skin.id === id && (!heroId || skin.heroId === heroId),
  );
}
export function validatePosterId(value: unknown, heroId: string): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !findHeroSkin(value, heroId))
    throw new Error('请从当前英雄的皮肤库中选择海报');
  return value;
}
export function skinImageUrl(
  id: string,
  size: 'image' | 'thumbnail' | 'avatar' = 'image',
) {
  return `/api/skin-image?id=${encodeURIComponent(id)}&size=${size}`;
}
