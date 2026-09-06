import { runeColors, type CatalogItem, type CatalogKind } from './catalog';

// Editorial groups inferred from the supplied 2026-09-06 source snapshot.
// Not a numeric power ranking. Preserve source order within each group.
const glyphGroups = [
  [42],
  [40],
  [14, 27, 38, 39, 41],
  [23, 24, 25, 26],
  [22],
  [10, 11, 19, 21, 35, 37],
  [7, 12, 13, 16, 17, 20, 30, 36],
  [1, 2, 3, 4, 5, 6, 8, 9, 15, 18, 28, 29, 31, 32, 33, 34],
];
const priority = new Map<string, number>(
  glyphGroups.flatMap((group, index) =>
    group.map(
      (number) =>
        [`doc-glyph-${String(number).padStart(3, '0')}`, index] as const,
    ),
  ),
);
export function sortCatalogItems(kind: CatalogKind, items: CatalogItem[]) {
  const rank = (item: CatalogItem) =>
    kind === 'glyphs'
      ? (priority.get(item.id) ?? glyphGroups.length)
      : runeColors.findIndex((color) => color === item.color) < 0
        ? runeColors.length
        : runeColors.findIndex((color) => color === item.color);
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map((entry) => entry.item);
}
export function catalogViewItems(
  kind: CatalogKind,
  saved: CatalogItem[],
  latest: CatalogItem[],
  selectedIds: string[],
) {
  const merged = new Map([...saved, ...latest].map((item) => [item.id, item]));
  for (const item of saved)
    if (selectedIds.includes(item.id)) merged.set(item.id, item);
  return sortCatalogItems(kind, [...merged.values()]);
}
