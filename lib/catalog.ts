export type CatalogItem = {
  id: string;
  name: string;
  effect: string;
  usage: string;
  source?: string;
  color?: string;
  icon?: string;
  image?: string;
};
export type CatalogKind = 'glyphs' | 'runes';
export const runeColors = ['红色', '蓝色', '绿色'] as const;
export function validateRuneColors(items: CatalogItem[]) {
  if (items.some((item) => !runeColors.some((color) => color === item.color)))
    throw new Error('铭文请选择红色、蓝色或绿色');
}
export type Catalog = {
  kind: CatalogKind;
  revision: number;
  items: CatalogItem[];
};
export type Libraries = { glyphs: Catalog; runes: Catalog };
export const emptyLibraries: Libraries = {
  glyphs: { kind: 'glyphs', revision: 0, items: [] },
  runes: { kind: 'runes', revision: 0, items: [] },
};
export function validateCatalog(input: unknown): CatalogItem[] {
  if (!Array.isArray(input) || input.length > 240)
    throw new Error('资料库最多240条');
  const field = (v: unknown, max: number, required = false) => {
    if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
      throw new Error('请填写名称与效果，或缩短过长的内容');
    return v.trim();
  };
  const items = input.map((v) => {
    if (!v || typeof v !== 'object' || Array.isArray(v))
      throw new Error('资料格式错误');
    return {
      id: field(v.id, 80, true),
      name: field(v.name, 60, true),
      effect: field(v.effect, 2500, true),
      usage: field(v.usage || '', 2500),
      source: field(v.source || '', 500),
      color: field(v.color || '', 30),
      icon: catalogImage(v.icon),
      image: catalogImage(v.image),
    };
  });
  if (
    new Set(items.map((i) => i.id)).size !== items.length ||
    new Set(items.map((i) => i.name)).size !== items.length
  )
    throw new Error('名称或编号重复');
  return items;
}
export function catalogImage(value: unknown): string {
  if (!value) return '';
  if (
    typeof value !== 'string' ||
    value.length > 500 ||
    !/^(https:\/\/|\/(?!\/))/.test(value)
  )
    throw new Error('图片请使用 HTTPS 链接或本站图片路径');
  return value;
}
