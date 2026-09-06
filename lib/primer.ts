import initial from '@/data/initial-primer.json';
import { catalogImage } from './catalog';
export type PrimerImage = { src: string; alt: string; caption: string };
export type PrimerSection = {
  id: string;
  kind: 'glyph' | 'tier' | 'note';
  title: string;
  body: string;
  source: string;
  images?: PrimerImage[];
};
export type Primer = {
  revision: number;
  title: string;
  intro: string;
  sections: PrimerSection[];
};
export function validatePrimer(input: unknown): Omit<Primer, 'revision'> {
  const p = input as Partial<Primer>;
  const field = (value: unknown, max: number, required = false) => {
    if (
      typeof value !== 'string' ||
      value.length > max ||
      (required && !value.trim())
    )
      throw new Error('请填写标题和内容，并缩短超长文本');
    return value.trim();
  };
  if (
    !p ||
    !Array.isArray(p.sections) ||
    !p.sections.length ||
    p.sections.length > 24
  )
    throw new Error('前瞻请保留1至24个章节');
  const sections = p.sections.map((s) => {
    if (!s || !['glyph', 'tier', 'note'].includes(s.kind))
      throw new Error('前瞻章节类型不正确');
    if (
      s.images !== undefined &&
      (!Array.isArray(s.images) || s.images.length > 12)
    )
      throw new Error('每个前瞻章节最多12张配图');
    const images = (s.images || []).map((img) => {
      if (!img || !img.src) throw new Error('请填写配图地址，或删除空白配图');
      return {
        src: catalogImage(img.src),
        alt: field(img.alt, 120, true),
        caption: field(img.caption || '', 500),
      };
    });
    return {
      id: field(s.id, 80, true),
      kind: s.kind,
      title: field(s.title, 100, true),
      body: field(s.body, 6000, true),
      source: field(s.source || '', 1000),
      images,
    };
  });
  if (new Set(sections.map((s) => s.id)).size !== sections.length)
    throw new Error('前瞻章节编号重复');
  return {
    title: field(p.title, 100, true),
    intro: field(p.intro, 2000),
    sections,
  };
}
export const initialPrimer: Primer = {
  ...validatePrimer(initial),
  revision: 0,
};
