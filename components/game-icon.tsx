// Original category artwork; these are not official hero skill icons.
export function GameIcon({
  kind,
}: {
  kind: 'core' | 'talent' | 'glyph' | 'rune';
}) {
  return <span className={`game-icon game-icon-${kind}`} aria-hidden="true" />;
}
