import type { CatalogItem } from '@/lib/catalog';
import { glyphArtwork } from '@/lib/glyph-art';
import { GameIcon } from './game-icon';
export function GlyphIcon({ item }: { item: CatalogItem }) {
  const { image: src, cardImage } = glyphArtwork(item);
  return src ? (
    <span className={`glyph-art ${cardImage ? 'from-card' : 'standalone'}`}>
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
    </span>
  ) : (
    <GameIcon kind="glyph" />
  );
}
