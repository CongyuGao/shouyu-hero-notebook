import type { CatalogItem } from './catalog';

// Exact source asset for the formerly icon-less entry. This also repairs its
// older guide snapshots without changing their text, selections or timestamps.
const originalIcons: Record<string, string> = {
  'user-glyph-shunxi-baoji': '/glyph-icons/shunxi-baoji.png',
};

export function glyphArtwork(
  item?: Pick<CatalogItem, 'id' | 'icon' | 'image'>,
) {
  if (item?.icon) return { image: item.icon, cardImage: false };
  if (item?.image) return { image: item.image, cardImage: true };
  return { image: item ? originalIcons[item.id] : undefined, cardImage: false };
}
