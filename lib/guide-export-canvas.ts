import type { ExportChoice, GuideExport } from './guide-export';

export const EXPORT_WIDTH = 1080;
export const EXPORT_MAX_HEIGHT = 4800;
const PAD = 60,
  GAP = 16,
  INNER = EXPORT_WIDTH - PAD * 2;
const FONT =
  '"PingFang SC", "Microsoft YaHei", "Arial Unicode MS", system-ui, sans-serif';
const DISPLAY_FONT =
  '"Songti SC", "STSong", "Noto Serif CJK SC", "Arial Unicode MS", serif';
export const EXPORT_ART = {
  brand: '/brand-mark.svg',
  icons: '/game-icon-atlas.png',
  backdrop: '/arcane-sanctum.png',
} as const;
const INK = '#eff5ff',
  MUTED = '#b2c3da',
  GOLD = '#e9c581';
type Draw = (ctx: CanvasRenderingContext2D) => void;
type Page = {
  operations: Draw[];
  bottom: number;
  height: number;
  title: string;
};
type Assets = Map<string, HTMLImageElement>;
export type ExportedImage = {
  blob: Blob;
  width: number;
  height: number;
  name: string;
  title: string;
};

function font(
  ctx: CanvasRenderingContext2D,
  size: number,
  bold = false,
  display = false,
) {
  ctx.font = `${bold ? 'bold' : 'normal'} ${size}px ${display ? DISPLAY_FONT : FONT}`;
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
  display = false,
) {
  font(ctx, size, bold, display);
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
  display = false,
) {
  font(ctx, size, bold, display);
  ctx.fillStyle = color;
  text.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string | CanvasGradient,
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

type Emblem = 'core' | 'talent' | 'glyph' | 'rune';
function emblem(
  c: CanvasRenderingContext2D,
  assets: Assets,
  kind: Emblem,
  x: number,
  y: number,
  size: number,
  active = true,
) {
  const atlas = assets.get(EXPORT_ART.icons);
  if (!atlas) return;
  const [col, row] = {
    core: [0, 0],
    talent: [1, 0],
    glyph: [0, 1],
    rune: [1, 1],
  }[kind];
  c.save();
  c.globalAlpha = active ? 1 : 0.42;
  const w = atlas.naturalWidth / 2,
    h = atlas.naturalHeight / 2;
  c.drawImage(atlas, col * w, row * h, w, h, x, y, size, size);
  c.restore();
}
function jewel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  // A color-key marker, not an invented official rune icon.
  const fill = c.createLinearGradient(x, y, x + size, y + size);
  fill.addColorStop(0, '#f5f4ff');
  fill.addColorStop(0.38, color);
  fill.addColorStop(1, '#172138');
  c.save();
  c.beginPath();
  c.moveTo(x + size / 2, y);
  c.lineTo(x + size, y + size / 2);
  c.lineTo(x + size / 2, y + size);
  c.lineTo(x, y + size / 2);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.stroke();
  c.restore();
}
function framedCard(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  selected: boolean,
  surface: string,
) {
  const fill = c.createLinearGradient(x, y, x + width, y + height);
  fill.addColorStop(0, selected ? surface : '#111c2b');
  fill.addColorStop(1, selected ? '#142238' : '#0c1726');
  c.save();
  if (selected) {
    c.shadowColor = `${color}20`;
    c.shadowBlur = 14;
  }
  box(c, x, y, width, height, fill, selected ? `${color}b8` : '#354358');
  c.restore();
  if (selected) {
    c.fillStyle = color;
    c.fillRect(x + 16, y + height - 3, Math.min(58, width / 3), 3);
    c.beginPath();
    c.moveTo(x + width - 24, y + 3);
    c.lineTo(x + width - 3, y + 3);
    c.lineTo(x + width - 3, y + 24);
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.stroke();
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
  const nameLines = lines(ctx, model.buildName, INNER, 48, true, true);
  const metadata = [
    `更新 ${model.publishedDate}`,
    model.version,
    model.author && `作者 ${model.author}`,
    model.poster?.name && `海报 ${model.poster.name}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const metaLines = lines(ctx, metadata, INNER, 27);
  const headerBottom = 250 + nameLines.length * 62 + metaLines.length * 40 + 40;
  const linkLines = lines(ctx, model.publicUrl, INNER, 24);
  const footerHeight = 116 + linkLines.length * 32;
  const limit = EXPORT_MAX_HEIGHT - footerHeight;
  let page!: Page;
  let y = headerBottom;
  function newPage(title = page?.title || '加点总览') {
    if (pages.length >= 64)
      throw new Error('说明内容过长，请先只导出加点总览，或缩短流派备注。');
    page = { operations: [], bottom: headerBottom, height: 0, title };
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
    lines(ctx, section.title, INNER - 112, headingSize, true, true).length *
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
                lines(
                  ctx,
                  item.name,
                  width - 40,
                  choiceSize,
                  true,
                  section.title.endsWith('核心'),
                ).length,
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
    if (section.pageTitle && page.operations.length) newPage(section.pageTitle);
    else if (
      section.breakBefore &&
      section.kind === 'text' &&
      page.operations.length
    )
      newPage('思路与打法');
    if (section.breakBefore && section.kind === 'choices') {
      const next = model.sections[sectionIndex + 1];
      const groupHeight =
        choicesHeight(section) +
        (next?.title.endsWith('小天赋') ? choicesHeight(next) : 0);
      if (groupHeight <= limit - headerBottom && y + groupHeight > limit)
        newPage();
    }
    const category: Emblem = section.kind.startsWith('glyph')
      ? 'glyph'
      : section.kind === 'runes' || section.title.startsWith('铭文')
        ? 'rune'
        : section.title.includes('核心')
          ? 'core'
          : 'talent';
    const accent =
      category === 'core'
        ? '#f5b6ca'
        : category === 'talent' && section.kind !== 'text'
          ? '#c4b2ff'
          : section.accent || GOLD;
    const titleLines = lines(
      ctx,
      section.title,
      INNER - 112,
      headingSize,
      true,
      true,
    );
    const headingHeight = headingHeightFor(section);
    const heading = (
      c: CanvasRenderingContext2D,
      top: number,
      continued = false,
    ) => {
      const band = c.createLinearGradient(PAD, top, PAD + INNER, top);
      band.addColorStop(0, `${accent}16`);
      band.addColorStop(1, `${accent}00`);
      box(c, PAD, top - 4, INNER, headingHeight - 12, band);
      emblem(c, assets, category, PAD + 3, top + 2, 70);
      write(
        c,
        titleLines,
        PAD + 90,
        top,
        headingSize,
        accent,
        true,
        headingLine,
        true,
      );
      if (section.subtitle)
        write(
          c,
          [section.subtitle],
          PAD + 90,
          top + titleLines.length * headingLine + 2,
          28,
          MUTED,
        );
      if (continued)
        write(c, ['续'], EXPORT_WIDTH - PAD - 32, top + 6, 28, MUTED);
    };
    if (section.kind === 'glyph-details' || section.kind === 'skill-details') {
      const columns =
        section.kind === 'skill-details' && category === 'core' ? 1 : 2;
      const width = (INNER - GAP * (columns - 1)) / columns;
      const choices = section.choices || [];
      let first = true;
      for (let index = 0; index < choices.length; index += columns) {
        const row = choices.slice(index, index + columns).map((choice) => ({
          choice,
          title: lines(ctx, choice.name, width - 148, 36, true, true),
          body: lines(
            ctx,
            `${choice.effect || ''}${choice.usage ? `\n\n搭配说明\n${choice.usage}` : ''}`,
            width - 48,
            32,
          ),
        }));
        const cardHeader = Math.max(
          132,
          ...row.map((item) => item.title.length * 48 + 60),
        );
        const maxLines = Math.floor(
          (limit - headerBottom - headingHeight - cardHeader - 44 - GAP) / 46,
        );
        if (maxLines < 1) throw new Error('条目名称过长，请缩短名称后再导出。');
        const longest = Math.max(1, ...row.map((item) => item.body.length));
        for (let offset = 0; offset < longest; offset += maxLines) {
          const rowHeight =
            cardHeader + Math.min(maxLines, longest - offset) * 46 + 28;
          const needsHeading = first || y + rowHeight + GAP > limit;
          const continued = !first || offset > 0;
          add(
            rowHeight + GAP + (needsHeading ? headingHeight : 0),
            (c, top) => {
              if (needsHeading) {
                heading(c, top, continued);
                top += headingHeight;
              }
              row.forEach(({ choice, title, body }, column) => {
                const x = PAD + column * (width + GAP);
                const part = body.slice(offset, offset + maxLines);
                if (!part.length && offset) return;
                framedCard(
                  c,
                  x,
                  top,
                  width,
                  rowHeight,
                  accent,
                  true,
                  category === 'glyph' ? '#342d32' : '#252b43',
                );
                if (section.kind === 'skill-details')
                  emblem(c, assets, category, x + 20, top + 20, 92);
                else
                  artwork(
                    c,
                    assets,
                    choice.image,
                    x + 20,
                    top + 20,
                    92,
                    92,
                    choice.name,
                    choice.cardImage,
                  );
                write(c, title, x + 132, top + 22, 36, accent, true, 48, true);
                write(
                  c,
                  [offset ? '效果续文' : choice.color || '雕文效果'],
                  x + 132,
                  top + 28 + title.length * 48,
                  25,
                  MUTED,
                );
                write(c, part, x + 24, top + cardHeader, 32, INK, false, 46);
              });
            },
          );
          first = false;
        }
      }
      y = Math.min(limit, y + 16);
      page.bottom = y;
      continue;
    }
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
        lines(
          ctx,
          item.name,
          width - 40,
          choiceSize,
          true,
          category === 'core',
        ),
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
          const surface =
            section.kind === 'runes'
              ? { 红色: '#402333', 蓝色: '#193d55', 绿色: '#1c443c' }[
                  choice.color || ''
                ] || '#25324a'
              : category === 'core'
                ? '#462a3e'
                : category === 'talent'
                  ? '#303057'
                  : '#3b3033';
          framedCard(
            c,
            x,
            top,
            width,
            rowHeight,
            color,
            choice.selected,
            surface,
          );
          if (section.kind === 'runes') {
            jewel(c, x + 20, top + 15, 25, color);
            write(
              c,
              [choice.effect || '铭文'],
              x + 58,
              top + 13,
              25,
              color,
              true,
            );
          } else {
            if (!hasImage)
              emblem(c, assets, category, x + 12, top + 6, 42, choice.selected);
            if (category === 'core')
              write(
                c,
                ['流派核心'],
                x + 62,
                top + 13,
                24,
                choice.selected ? color : '#8092ab',
              );
            box(
              c,
              x + width - 106,
              top + 10,
              94,
              34,
              choice.selected ? `${color}24` : '#1c293b',
            );
            write(
              c,
              [choice.selected ? '✓ 已选' : '— 未选'],
              x + width - 98,
              top + 14,
              22,
              choice.selected ? color : '#899bb2',
              true,
            );
          }
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
            category === 'core',
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
        const selectedPoster = model.poster && assets.get(model.poster.image);
        const backdrop = selectedPoster || assets.get(EXPORT_ART.backdrop);
        if (backdrop) {
          c.save();
          c.globalAlpha = selectedPoster ? 1 : 0.45;
          const coverHeight = headerBottom + 170;
          const ratio = Math.max(
            EXPORT_WIDTH / backdrop.naturalWidth,
            coverHeight / backdrop.naturalHeight,
          );
          const sw = EXPORT_WIDTH / ratio,
            sh = coverHeight / ratio;
          c.drawImage(
            backdrop,
            (backdrop.naturalWidth - sw) / 2,
            (backdrop.naturalHeight - sh) / 2,
            sw,
            sh,
            0,
            0,
            EXPORT_WIDTH,
            coverHeight,
          );
          c.restore();
          if (selectedPoster) {
            const veil = c.createLinearGradient(0, 0, EXPORT_WIDTH, 0);
            veil.addColorStop(0, '#071426ef');
            veil.addColorStop(0.5, '#0c193594');
            veil.addColorStop(1, '#0c193522');
            c.fillStyle = veil;
            c.fillRect(0, 0, EXPORT_WIDTH, coverHeight);
          }
          const fade = c.createLinearGradient(
            0,
            headerBottom - 60,
            0,
            headerBottom + 170,
          );
          fade.addColorStop(0, '#10273f00');
          fade.addColorStop(1, '#10273fff');
          c.fillStyle = fade;
          c.fillRect(0, headerBottom - 60, EXPORT_WIDTH, 230);
        }
        const glow = c.createRadialGradient(900, 0, 0, 900, 0, 650);
        glow.addColorStop(0, '#94754226');
        glow.addColorStop(1, '#94754200');
        c.fillStyle = glow;
        c.fillRect(0, 0, EXPORT_WIDTH, p.height);
        c.strokeStyle = '#e9c58140';
        c.lineWidth = 2;
        c.strokeRect(22, 22, EXPORT_WIDTH - 44, p.height - 44);
        c.strokeStyle = '#e5c894';
        c.lineWidth = 3;
        for (const [x, yy, dx, dy] of [
          [22, 22, 1, 1],
          [EXPORT_WIDTH - 22, 22, -1, 1],
          [22, p.height - 22, 1, -1],
          [EXPORT_WIDTH - 22, p.height - 22, -1, -1],
        ]) {
          c.beginPath();
          c.moveTo(x, yy + 44 * dy);
          c.lineTo(x, yy);
          c.lineTo(x + 44 * dx, yy);
          c.stroke();
        }
        const brand = assets.get(EXPORT_ART.brand);
        if (brand) c.drawImage(brand, PAD - 4, 38, 64, 64);
        else write(c, ['守'], PAD + 8, 46, 40, GOLD, true);
        write(c, ['守御手册'], PAD + 76, 42, 32, '#f1dab0', true, 42, true);
        write(c, ['无尽守御 · 英雄攻略'], PAD + 78, 84, 23, '#acbbd2');
        box(c, EXPORT_WIDTH - PAD - 148, 46, 148, 42, '#1b2b42', '#6f655548');
        write(
          c,
          [
            `${String(index + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`,
          ],
          EXPORT_WIDTH - PAD - 132,
          53,
          26,
          GOLD,
          true,
        );
        artwork(c, assets, model.avatar, PAD, 126, 108, 108, model.heroName);
        c.strokeStyle = '#ddbd84a0';
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(PAD - 5, 121, 118, 118, 22);
        c.stroke();
        write(
          c,
          [model.heroName],
          PAD + 136,
          128,
          64,
          '#fff1d6',
          true,
          76,
          true,
        );
        write(c, [p.title], PAD + 140, 204, 26, '#a8beda');
        if (model.tier) {
          const tierColor =
            (
              {
                T0: '#ffd27e',
                T1: '#ffb3ba',
                'T1.5': '#c6b3ff',
                T2: '#8dd6ed',
                T3: '#acc0d9',
              } as Record<string, string>
            )[model.tier] || GOLD;
          box(
            c,
            EXPORT_WIDTH - PAD - 138,
            141,
            138,
            58,
            `${tierColor}18`,
            `${tierColor}88`,
          );
          write(
            c,
            [model.tier],
            EXPORT_WIDTH - PAD - 124,
            151,
            38,
            tierColor,
            true,
          );
        }
        write(c, nameLines, PAD, 250, 48, '#f4e9d4', true, 62, true);
        write(
          c,
          metaLines,
          PAD,
          260 + nameLines.length * 62,
          27,
          MUTED,
          false,
          40,
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
        model.poster?.image,
        ...Object.values(EXPORT_ART),
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
        title: page.title,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const failedImages = [
      model.avatar,
      model.poster?.image,
      ...model.sections.flatMap((s) => s.choices?.map((c) => c.image) || []),
    ].filter((src) => src && !assets.has(src));
    return { images, missingImages: new Set(failedImages).size };
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}
