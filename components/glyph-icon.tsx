import type { CatalogItem } from '@/lib/catalog';
import { GameIcon } from './game-icon';
export function GlyphIcon({ item }: { item: CatalogItem }) {
  const src = item.icon || item.image;
  return src ? (
    <span className={`glyph-art ${item.icon ? 'standalone' : 'from-card'}`}>
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
    </span>
  ) : (
    <GameIcon kind="glyph" />
  );
}
