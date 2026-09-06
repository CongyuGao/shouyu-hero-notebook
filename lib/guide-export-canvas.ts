import type { ExportChoice, GuideExport } from './guide-export';

export const EXPORT_WIDTH = 1080;
export const EXPORT_MAX_HEIGHT = 4800;
const PAD = 60,
  GAP = 16,
  INNER = EXPORT_WIDTH - PAD * 2;
const FONT =
  '"PingFang SC", "Microsoft YaHei", "Arial Unicode MS", system-ui, sans-serif';
const INK = '#eff5ff',
  MUTED = '#b2c3da',
  GOLD = '#e9c581';
type Draw = (ctx: CanvasRenderingContext2D) => void;
type Page = { operations: Draw[]; bottom: number; height: number };
type Assets = Map<string, HTMLImageElement>;
export type ExportedImage = {
  blob: Blob;
  width: number;
  height: number;
  name: string;
};

function font(ctx: CanvasRenderingContext2D, size: number, bold = false) {
  ctx.font = `${bold ? 'bold' : 'normal'} ${size}px ${FONT}`;
  ctx.textBaseline = 'top';
}
export function wrapExportText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const lines: string[] = [];
  // Array.from retains surrogate pairs; no text or numerical effects are rewritten.
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const char of Array.from(paragraph)) {
      if (line && measure(line + char) > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
function lines(
  ctx: CanvasRenderingContext2D,
  value: string,
  width: number,
  size: number,
  bold = false,
) {
  font(ctx, size, bold);
  return wrapExportText(value, width, (s) => ctx.measureText(s).width);
}
function write(
  ctx: CanvasRenderingContext2D,
  text: string[],
  x: number,
  y: number,
  size: number,
  color = INK,
  bold = false,
  lineHeight = size * 1.5,
) {
  font(ctx, size, bold);
  ctx.fillStyle = color;
  text.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 18);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
function artwork(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  src: string | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  cropLeft = false,
) {
  box(ctx, x, y, width, height, '#132842', '#416080');
  const img = src && assets.get(src);
  if (!img) {
    write(ctx, [label.slice(0, 1)], x + 20, y + 20, 42, MUTED, true);
    return;
  }
  const ratio = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const sw = width / ratio,
    sh = height / ratio;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 18);
  ctx.clip();
  ctx.drawImage(
    img,
    cropLeft ? 0 : (img.naturalWidth - sw) / 2,
    (img.naturalHeight - sh) / 2,
    sw,
    sh,
    x,
    y,
    width,
    height,
  );
  ctx.restore();
}

// Layout first, paint one bounded-size canvas at a time. Never make an enormous
// mobile canvas or silently truncate an effect to force it onto one image.
export function layoutGuideExport(
  model: GuideExport,
  ctx: CanvasRenderingContext2D,
  assets: Assets = new Map(),
): Page[] {
  const pages: Page[] = [];
  const nameLines = lines(ctx, model.buildName, INNER, 46, true);
  const metadata = [
    `更新 ${model.publishedDate}`,
    model.version,
    model.author && `作者 ${model.author}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const metaLines = lines(ctx, metadata, INNER, 28);
  const headerBottom = 190 + nameLines.length * 62 + metaLines.length * 42 + 50;
  const linkLines = lines(ctx, model.publicUrl, INNER, 24);
  const footerHeight = 116 + linkLines.length * 32;
  const limit = EXPORT_MAX_HEIGHT - footerHeight;
  let page!: Page;
  let y = headerBottom;
  function newPage() {
    if (pages.length >= 64)
      throw new Error('说明内容过长，请先只导出加点总览，或缩短流派备注。');
    page = { operations: [], bottom: headerBottom, height: 0 };
    pages.push(page);
    y = headerBottom;
  }
  function add(
    height: number,
    draw: (c: CanvasRenderingContext2D, top: number) => void,
  ) {
    if (height > limit - headerBottom)
      throw new Error('某项名称或说明过长，无法清晰排版，请缩短名称后重试。');
    if (y + height > limit) newPage();
    const top = y;
    page.operations.push((c) => draw(c, top));
    y += height;
    page.bottom = y;
  }
  newPage();
  const headingSize = 36,
    headingLine = 48,
    choiceSize = 36,
    choiceLine = 48;
  const columnsFor = (section: GuideExport['sections'][number]) =>
    section.kind === 'glyphs' || section.kind === 'runes'
      ? 3
      : section.title.endsWith('小天赋')
        ? 4
        : 2;
  const headingHeightFor = (section: GuideExport['sections'][number]) =>
    lines(ctx, section.title, INNER - 48, headingSize, true).length *
      headingLine +
    (section.subtitle ? 48 : 24);
  const choicesHeight = (section: GuideExport['sections'][number]) => {
    const columns = columnsFor(section);
    const width = (INNER - GAP * (columns - 1)) / columns;
    const choices = section.choices?.length
      ? section.choices
      : [{ name: '未选择' }];
    let height = headingHeightFor(section) + 16;
    for (let i = 0; i < choices.length; i += columns) {
      height +=
        Math.max(
          ...choices
            .slice(i, i + columns)
            .map(
              (item) =>
                lines(ctx, item.name, width - 40, choiceSize, true).length,
            ),
        ) *
          choiceLine +
        (section.kind === 'glyphs' ? 164 : 66) +
        GAP;
    }
    return height;
  };
  for (const [sectionIndex, section] of model.sections.entries()) {
    // Flow through every skill automatically; only optional full explanations
    // explicitly start a separate image. Keep normal-sized skill groups whole.
    if (
      section.breakBefore &&
      section.kind === 'text' &&
      page.operations.length
    )
      newPage();
    if (section.breakBefore && section.kind === 'choices') {
      const next = model.sections[sectionIndex + 1];
      const groupHeight =
        choicesHeight(section) +
        (next?.title.endsWith('小天赋') ? choicesHeight(next) : 0);
      if (groupHeight <= limit - headerBottom && y + groupHeight > limit)
        newPage();
    }
    const accent = section.accent || GOLD;
    const titleLines = lines(ctx, section.title, INNER - 48, headingSize, true);
    const headingHeight = headingHeightFor(section);
    const heading = (
      c: CanvasRenderingContext2D,
      top: number,
      continued = false,
    ) => {
      c.fillStyle = accent;
      c.fillRect(PAD, top + 5, 6, 38);
      write(
        c,
        titleLines,
        PAD + 24,
        top,
        headingSize,
        accent,
        true,
        headingLine,
      );
      if (section.subtitle)
        write(
          c,
          [section.subtitle],
          PAD + 24,
          top + titleLines.length * headingLine + 2,
          28,
          MUTED,
        );
      if (continued)
        write(c, ['续'], EXPORT_WIDTH - PAD - 32, top + 6, 28, MUTED);
    };
    if (section.kind === 'text') {
      const body = lines(ctx, section.text || '', INNER - 56, 36);
      const maxLines = Math.floor(
        (limit - headerBottom - headingHeight - 64) / 54,
      );
      if (maxLines < 1)
        throw new Error('名称或版本说明过长，请缩短后重新导出。');
      for (let offset = 0; offset < body.length; offset += maxLines) {
        const part = body.slice(offset, offset + maxLines);
        const height = headingHeight + part.length * 54 + 64;
        add(height, (c, top) => {
          heading(c, top, offset > 0);
          box(
            c,
            PAD,
            top + headingHeight,
            INNER,
            part.length * 54 + 32,
            '#112239',
          );
          write(
            c,
            part,
            PAD + 28,
            top + headingHeight + 16,
            36,
            INK,
            false,
            54,
          );
        });
      }
      continue;
    }
    const choices = section.choices || [];
    const columns = columnsFor(section);
    const width = (INNER - GAP * (columns - 1)) / columns;
    let first = true;
    const rows = choices.length
      ? choices
      : [{ name: '未选择', selected: false }];
    for (let index = 0; index < rows.length; index += columns) {
      const row = rows.slice(index, index + columns);
      const titles = row.map((item) =>
        lines(ctx, item.name, width - 40, choiceSize, true),
      );
      const hasImage = section.kind === 'glyphs';
      const rowHeight =
        Math.max(...titles.map((t) => t.length)) * choiceLine +
        (hasImage ? 164 : 66);
      const needsHeading = first || y + rowHeight + GAP > limit;
      const continued = !first;
      const total = rowHeight + GAP + (needsHeading ? headingHeight : 0);
      add(total, (c, top) => {
        if (needsHeading) {
          heading(c, top, continued);
          top += headingHeight;
        }
        row.forEach((choice: ExportChoice, column) => {
          const x = PAD + column * (width + GAP);
          const color =
            section.kind === 'runes'
              ? { 红色: '#ff94a4', 蓝色: '#88caff', 绿色: '#8be3b1' }[
                  choice.color || ''
                ] || accent
              : accent;
          box(
            c,
            x,
            top,
            width,
            rowHeight,
            choice.selected ? '#17354a' : '#101f32',
            choice.selected ? color : '#33465d',
          );
          if (choice.selected) {
            c.fillStyle = color;
            c.fillRect(x + 2, top + 22, 5, rowHeight - 44);
          }
          write(
            c,
            [
              section.kind === 'runes'
                ? choice.effect || '铭文'
                : choice.selected
                  ? '✓ 已选'
                  : '— 未选',
            ],
            x + 20,
            top + 12,
            26,
            choice.selected ? color : '#91a4be',
            true,
          );
          if (hasImage)
            artwork(
              c,
              assets,
              choice.image,
              x + 20,
              top + 50,
              88,
              88,
              choice.name,
              choice.cardImage,
            );
          write(
            c,
            titles[column],
            x + 20,
            top + (hasImage ? 152 : 54),
            choiceSize,
            choice.selected ? INK : '#a7b6ca',
            true,
            choiceLine,
          );
          if (hasImage && choice.effect)
            write(c, [choice.effect], x + 124, top + 74, 26, color);
        });
      });
      first = false;
    }
    // Spacing alone must never create a page with just a header and footer.
    y = Math.min(limit, y + 16);
    page.bottom = y;
  }
  pages.forEach((p, index) => {
    p.height = Math.min(
      EXPORT_MAX_HEIGHT,
      Math.max(960, p.bottom + footerHeight),
    );
    const operations = p.operations;
    p.operations = [
      (c) => {
        const gradient = c.createLinearGradient(0, 0, EXPORT_WIDTH, p.height);
        gradient.addColorStop(0, '#10273f');
        gradient.addColorStop(0.55, '#0a172a');
        gradient.addColorStop(1, '#071222');
        c.fillStyle = gradient;
        c.fillRect(0, 0, EXPORT_WIDTH, p.height);
        const glow = c.createRadialGradient(900, 0, 0, 900, 0, 650);
        glow.addColorStop(0, '#94754226');
        glow.addColorStop(1, '#94754200');
        c.fillStyle = glow;
        c.fillRect(0, 0, EXPORT_WIDTH, p.height);
        c.strokeStyle = '#e9c58140';
        c.lineWidth = 2;
        c.strokeRect(22, 22, EXPORT_WIDTH - 44, p.height - 44);
        write(c, ['守御手册 / 无尽守御'], PAD, 44, 28, GOLD, true);
        write(
          c,
          [`${index + 1} / ${pages.length}`],
          EXPORT_WIDTH - PAD - 100,
          44,
          28,
          GOLD,
          true,
        );
        artwork(c, assets, model.avatar, PAD, 96, 84, 84, model.heroName);
        write(c, [model.heroName], PAD + 108, 104, 54, INK, true);
        if (model.tier)
          write(c, [model.tier], EXPORT_WIDTH - PAD - 150, 108, 44, GOLD, true);
        write(c, nameLines, PAD, 198, 46, INK, true, 62);
        write(
          c,
          metaLines,
          PAD,
          208 + nameLines.length * 62,
          28,
          MUTED,
          false,
          42,
        );
      },
      ...operations,
      (c) => {
        const top = p.height - footerHeight + 22;
        c.strokeStyle = '#7790ae50';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(PAD, top);
        c.lineTo(EXPORT_WIDTH - PAD, top);
        c.stroke();
        write(c, ['✓ 亮色为已选 · 暗色为未选'], PAD, top + 22, 26, MUTED);
        write(
          c,
          ['创作者 · 漫游的逗号'],
          EXPORT_WIDTH - PAD - 280,
          top + 22,
          24,
          MUTED,
        );
        write(c, linkLines, PAD, top + 66, 24, '#8fa9c9', false, 32);
      },
    ];
  });
  return pages;
}

async function loadAssets(
  model: GuideExport,
  signal?: AbortSignal,
): Promise<Assets> {
  const urls = [
    ...new Set(
      [
        model.avatar,
        ...model.sections.flatMap((s) => s.choices?.map((c) => c.image) || []),
      ].filter((u): u is string => !!u),
    ),
  ];
  const assets: Assets = new Map();
  await Promise.all(
    urls.map(
      (src) =>
        new Promise<void>((resolve) => {
          if (signal?.aborted) {
            resolve();
            return;
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.referrerPolicy = 'no-referrer';
          const finish = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
            img.onload = null;
            img.onerror = null;
            resolve();
          };
          const cancel = () => {
            img.removeAttribute('src');
            finish();
          };
          const timer = setTimeout(cancel, 8000);
          signal?.addEventListener('abort', cancel, { once: true });
          img.onload = () => {
            if (img.naturalWidth) assets.set(src, img);
            finish();
          };
          img.onerror = finish;
          img.src = src;
        }),
    ),
  );
  return assets;
}

export async function renderGuideExport(
  model: GuideExport,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const assets = await loadAssets(model, signal);
  signal?.throwIfAborted();
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不能生成图片，请换系统浏览器打开。');
  const pages = layoutGuideExport(model, ctx, assets);
  const images: ExportedImage[] = [];
  const filename = `${model.heroName}-${model.buildName}-${model.publishedDate}`
    // Strip control characters as well as unsafe filename characters.
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .slice(0, 100);
  try {
    for (const [index, page] of pages.entries()) {
      signal?.throwIfAborted();
      canvas.height = page.height;
      page.operations.forEach((paint) => paint(ctx));
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(new Error('图片生成失败，请重试或关闭效果说明。')),
          'image/png',
        ),
      );
      images.push({
        blob,
        width: EXPORT_WIDTH,
        height: page.height,
        name: `${filename}-${String(index + 1).padStart(2, '0')}.png`,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const failedImages = [
      model.avatar,
      ...model.sections.flatMap((s) => s.choices?.map((c) => c.image) || []),
    ].filter((src) => src && !assets.has(src));
    return { images, missingImages: new Set(failedImages).size };
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
