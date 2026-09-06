import catalog from '@/data/hero-skins.json';
import communityCatalog from '@/data/hero-skins-community.json';

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
export const heroSkins = [...catalog, ...communityCatalog] as HeroSkin[];
export const skinCatalogSnapshotDate = '2026-08-27';
export function isPinnedSkinImage(source: string): boolean {
  if (
    /^https:\/\/raw\.githubusercontent\.com\/lengyibai\/wzry-material\/[a-f0-9]{40}\/heros\/[a-zA-Z0-9_\-]+\.(webp|png|jpg|jpeg)$/.test(
      source,
    )
  )
    return true;
  const match =
    /^https:\/\/raw\.githubusercontent\.com\/yansheng836\/hero-skin-image\/[a-f0-9]{40}\/(?:1phone-smallskin-images|3phone-bigskin-images|5wallpaper-bigskin-images)\/([^/?#]+)$/.exec(
      source,
    );
  if (!match) return false;
  try {
    const filename = decodeURIComponent(match[1]);
    return (
      filename.endsWith('.jpg') &&
      !/[\\/\u0000-\u001f]/.test(filename) &&
      encodeURIComponent(filename) === match[1]
    );
  } catch {
    return false;
  }
}
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
