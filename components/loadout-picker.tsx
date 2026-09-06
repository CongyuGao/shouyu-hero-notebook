'use client';
import { useEffect, useState } from 'react';
import { BookOpen, Check, Plus, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { GameIcon } from '@/components/game-icon';
import { GlyphIcon } from '@/components/glyph-icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch, readResponse } from '@/lib/client-api';
import type { Build, Guide } from '@/lib/guide';
import type { Libraries, CatalogItem, CatalogKind } from '@/lib/catalog';
import { runeColors, glyphGrade, glyphGrades } from '@/lib/catalog';
import { aggregateRuneStats } from '@/lib/rune-stats';

export function LoadoutPicker({
  guide,
  build,
  libraries,
  editable = false,
  onGuideChange,
  onBuildChange,
  onManage,
  onEdit,
  disabled = false,
  onEditKind,
  initialKind,
  onInitialKindOpened,
}: {
  guide: Guide;
  build: Build;
  libraries?: Libraries;
  editable?: boolean;
  onGuideChange?: (v: Partial<Guide>) => void;
  onBuildChange?: (v: Partial<Build>) => void;
  onManage?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  onEditKind?: (kind: CatalogKind) => void;
  initialKind?: CatalogKind;
  onInitialKindOpened?: () => void;
}) {
  const [open, setOpen] = useState<CatalogKind | null>(null),
    [query, setQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('全部');
  const [inspecting, setInspecting] = useState<CatalogItem | null>(null);
  const [publicLibrary, setPublicLibrary] = useState<Libraries>(),
    [libraryError, setLibraryError] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(false);
  const catalog = libraries || publicLibrary;
  async function openChooser(kind: CatalogKind) {
    setQuery('');
    setColorFilter('全部');
    setOpen(kind);
    if (!libraries) {
      setLibraryLoading(true);
      try {
        const r = await apiFetch('/api/library');
        setPublicLibrary(await readResponse<Libraries>(r));
        setLibraryError('');
      } catch (e) {
        setLibraryError((e as Error).message);
      } finally {
        setLibraryLoading(false);
      }
    }
  }
  useEffect(() => {
    if (editable && initialKind) {
      void openChooser(initialKind);
      onInitialKindOpened?.();
    }
  }, [initialKind]);
  const chosen = (kind: CatalogKind) =>
    kind === 'glyphs' ? build.glyphIds || [] : build.runeIds || [];
  const snapshot = (kind: CatalogKind) =>
    kind === 'glyphs' ? guide.glyphs || [] : guide.runeLibrary || [];
  const items = (kind: CatalogKind) =>
    Array.from(
      new Map(
        [...snapshot(kind), ...(catalog?.[kind].items || [])].map((i) => [
          i.id,
          i,
        ]),
      ).values(),
    );
  const runeCount = (id: string) => build.runeCounts?.[id] ?? 1;
  const runeStats = aggregateRuneStats(
    snapshot('runes'),
    Object.fromEntries(chosen('runes').map((id) => [id, runeCount(id)])),
  );
  const colorCount = (color?: string) =>
    chosen('runes')
      .filter(
        (id) => snapshot('runes').find((r) => r.id === id)?.color === color,
      )
      .reduce((n, id) => n + runeCount(id), 0);
  function pick(kind: CatalogKind, item: CatalogItem, checked: boolean) {
    if (disabled) return;
    const ids = chosen(kind).filter((id) => id !== item.id);
    if (checked && ids.length >= (kind === 'glyphs' ? 6 : 30)) return;
    if (kind === 'runes' && checked && colorCount(item.color) >= 10) return;
    const next = checked ? [...ids, item.id] : ids;
    if (checked)
      onGuideChange?.({
        [kind === 'glyphs' ? 'glyphs' : 'runeLibrary']: [
          ...snapshot(kind).filter((x) => x.id !== item.id),
          item,
        ],
      });
    onBuildChange?.(
      kind === 'glyphs'
        ? { glyphIds: next }
        : {
            runeIds: next,
            runeCounts: Object.fromEntries(
              next.map((id) => [id, id === item.id ? 1 : runeCount(id)]),
            ),
          },
    );
  }
  function sync() {
    if (disabled) return;
    onGuideChange?.({
      glyphs: (guide.glyphs || []).map(
        (g) => libraries?.glyphs.items.find((x) => x.id === g.id) || g,
      ),
      runeLibrary: (guide.runeLibrary || []).map(
        (r) => libraries?.runes.items.find((x) => x.id === r.id) || r,
      ),
    });
  }
  return (
    <section className="loadout-panel">
      <div className="board-toolbar">
        <div>
          <h2>雕文与铭文</h2>
          <p>
            {editable
              ? '每个流派独立搭配，选中后随攻略保存。'
              : '与当前流派配套的选择及属性介绍。'}
          </p>
        </div>
        {onEdit && (
          <Button variant="outline" className="touch" onClick={onEdit}>
            调整搭配
          </Button>
        )}
      </div>
      <div className="loadout-heading">
        <h3>
          <GameIcon kind="glyph" />
          雕文搭配
        </h3>
        <span>{chosen('glyphs').length} / 6</span>
        <Button
          className="touch"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            !editable && onEditKind
              ? onEditKind('glyphs')
              : void openChooser('glyphs')
          }
        >
          <Plus size={16} />
          {editable || onEditKind ? '从雕文库选择' : '查看雕文库'}
        </Button>
      </div>
      <div className="glyph-slots">
        {Array.from({ length: 6 }, (_, i) => {
          const item = snapshot('glyphs').find(
            (g) => g.id === chosen('glyphs')[i],
          );
          return (
            <Button
              variant="ghost"
              className={`glyph-slot ${item ? 'filled' : ''}`}
              key={i}
              onClick={() =>
                item
                  ? setInspecting(item)
                  : !editable && onEditKind
                    ? onEditKind('glyphs')
                    : void openChooser('glyphs')
              }
              aria-label={
                item
                  ? `查看${item.name}介绍`
                  : `第${i + 1}个雕文栏位，打开雕文库`
              }
            >
              <span className="glyph-slot-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              {item ? <GlyphIcon item={item} /> : <GameIcon kind="glyph" />}
              <strong>{item?.name || '待选择'}</strong>
              {item && <Check size={14} />}
            </Button>
          );
        })}
      </div>
      {!!chosen('glyphs').length && (
        <div className="loadout-effects">
          {chosen('glyphs')
            .map((id) => snapshot('glyphs').find((g) => g.id === id))
            .filter(Boolean)
            .map((g) => (
              <article key={g!.id}>
                <Button
                  className="glyph-effect-title"
                  variant="ghost"
                  onClick={() => setInspecting(g!)}
                >
                  <GlyphIcon item={g!} />
                  <span>
                    {g!.name}
                    <small>查看详情</small>
                  </span>
                </Button>
                <p className="preserve">{g!.effect}</p>
                {g!.usage && (
                  <p className="effect-usage preserve">{g!.usage}</p>
                )}
              </article>
            ))}
        </div>
      )}
      <div className="loadout-heading">
        <h3>
          <GameIcon kind="rune" />
          铭文搭配
        </h3>
        <span>
          {chosen('runes').reduce((n, id) => n + runeCount(id), 0)} / 30 枚
        </span>
        <Button
          className="touch"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            !editable && onEditKind
              ? onEditKind('runes')
              : void openChooser('runes')
          }
        >
          <Plus size={16} />
          {editable || onEditKind ? '从铭文库选择' : '查看铭文库'}
        </Button>
      </div>
      <div className="rune-color-counters" aria-label="各色铭文数量">
        {runeColors.map((color) => (
          <div key={color} className={`rune-color-counter rune-color-${color}`}>
            <span className="rune-jewel" aria-hidden="true" />
            <span>{color}铭文</span>
            <strong>
              {colorCount(color)}
              <small> / 10</small>
            </strong>
          </div>
        ))}
      </div>
      <section className="rune-stat-panel" aria-label="整套铭文属性加成">
        <div className="rune-stat-heading">
          <h4>整套铭文属性</h4>
          <span>
            {runeStats.runeTotal} 枚 ·{' '}
            {runeStats.complete ? '基础属性合计' : '部分属性待核对'}
          </span>
        </div>
        {runeStats.totals.length ? (
          <dl className="rune-stat-grid" aria-live="polite" aria-atomic="true">
            {runeStats.totals.map((stat) => (
              <div key={`${stat.stat}-${stat.unit}`}>
                <dt>{stat.stat}</dt>
                <dd>
                  {stat.value.startsWith('-') ? '' : '+'}
                  {stat.value}
                  {stat.unit === 'percent' ? '%' : ''}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">选入铭文后，这里会按数量汇总整套属性。</p>
        )}
        <p className="rune-stat-note">
          仅合计当前铭文的基础加成，不包含英雄基础属性、天赋、雕文或游戏内效果上限。
        </p>
        {!!runeStats.issues.length && (
          <div className="rune-stat-warning" role="status">
            <strong>以下内容未计入合计</strong>
            {runeStats.issues.map((issue, i) => (
              <p key={`${issue.runeId}-${i}`}>{issue.message}</p>
            ))}
          </div>
        )}
      </section>
      {chosen('runes').length ? (
        <div className="rune-selections">
          {chosen('runes')
            .map((id) => snapshot('runes').find((r) => r.id === id))
            .filter(Boolean)
            .map((r) => (
              <article key={r!.id} className={`rune-color-${r!.color}`}>
                <span className="rune-jewel" aria-hidden="true" />
                <div>
                  <span className={`rune-color-label rune-color-${r!.color}`}>
                    {r!.color} · 五级
                  </span>
                  <h4>
                    {r!.name} <small>× {runeCount(r!.id)}</small>
                  </h4>
                  <p className="preserve">{r!.effect}</p>
                  {editable && (
                    <Select
                      value={String(runeCount(r!.id))}
                      onValueChange={(v) =>
                        onBuildChange?.({
                          runeCounts: {
                            ...Object.fromEntries(
                              chosen('runes').map((id) => [id, runeCount(id)]),
                            ),
                            [r!.id]: Number(v),
                          },
                        })
                      }
                    >
                      <SelectTrigger aria-label={`${r!.name}数量`}>
                        <SelectValue>{runeCount(r!.id)} 枚</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(
                          (n) => (
                            <SelectItem
                              key={n}
                              value={String(n)}
                              disabled={
                                n + colorCount(r!.color) - runeCount(r!.id) > 10
                              }
                            >
                              {n} 枚
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </article>
            ))}
        </div>
      ) : (
        <p className="empty-inline">
          尚未配置铭文。
          {editable
            ? '从通用五级铭文库勾选后可调整数量，每种颜色最多10枚。'
            : ''}
        </p>
      )}
      {editable && (
        <div className="catalog-actions">
          <Button variant="ghost" className="touch" onClick={onManage}>
            <BookOpen size={16} />
            管理雕文 / 铭文库
          </Button>
          <Button
            variant="ghost"
            className="touch"
            disabled={disabled}
            onClick={sync}
          >
            <RefreshCw size={15} />
            同步库内属性到本篇
          </Button>
          <p>
            修改资料库不会自动改动已发布攻略；同步后保存或发布本篇即可更新。
          </p>
        </div>
      )}
      <Dialog
        open={!!open}
        onOpenChange={(v) => {
          if (!v) setOpen(null);
        }}
      >
        <DialogContent className="loadout-dialog" showCloseButton={false}>
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {open === 'glyphs' ? '雕文库' : '通用五级铭文库'}{' '}
                  <span className="catalog-count">
                    {chosen(open).length}
                    {open === 'glyphs' ? ' / 6' : ''}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  {editable
                    ? '勾选即加入编辑区，完成后记得保存攻略。'
                    : '可查看全部属性，已选项对应当前流派。'}
                  {open === 'glyphs'
                    ? '雕文最多6个。'
                    : '铭文属性为单枚数值，每色最多10枚，混搭可调整数量。'}
                </DialogDescription>
              </DialogHeader>
              <div className="searchbox">
                <Search size={18} />
                <Input
                  aria-label="搜索资料库"
                  placeholder="搜索名称或属性"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {open === 'runes' && (
                <div className="rune-color-filters" aria-label="按颜色筛选铭文">
                  {['全部', ...runeColors].map((color) => (
                    <Button
                      key={color}
                      className={`touch rune-filter rune-color-${color}`}
                      variant={colorFilter === color ? 'default' : 'outline'}
                      aria-pressed={colorFilter === color}
                      onClick={() => setColorFilter(color)}
                    >
                      {color !== '全部' && (
                        <span className="rune-jewel" aria-hidden="true" />
                      )}
                      {color}
                      {color !== '全部' && (
                        <small>{colorCount(color)} / 10</small>
                      )}
                    </Button>
                  ))}
                </div>
              )}
              {open === 'glyphs' && (
                <div
                  className="glyph-grade-filters"
                  aria-label="按等级筛选雕文"
                >
                  {[
                    '全部',
                    ...glyphGrades,
                    ...(items('glyphs').some(
                      (i) => glyphGrade(i.color) === '未分级',
                    )
                      ? ['未分级']
                      : []),
                  ].map((grade) => (
                    <Button
                      key={grade}
                      variant="outline"
                      className={`touch glyph-grade-${grade}`}
                      aria-pressed={colorFilter === grade}
                      onClick={() => setColorFilter(grade)}
                    >
                      {grade}
                      <small>
                        {
                          items('glyphs').filter(
                            (i) =>
                              grade === '全部' || glyphGrade(i.color) === grade,
                          ).length
                        }
                      </small>
                    </Button>
                  ))}
                </div>
              )}
              {libraryError && (
                <p role="alert" className="notice">
                  {libraryError}
                </p>
              )}
              {libraryLoading && (
                <p className="muted" aria-live="polite">
                  正在读取最新资料库…
                </p>
              )}
              <div className="catalog-pick-list">
                {items(open)
                  .filter(
                    (i) =>
                      colorFilter === '全部' ||
                      (open === 'runes'
                        ? i.color === colorFilter
                        : glyphGrade(i.color) === colorFilter),
                  )
                  .filter((i) =>
                    (i.name + i.effect + (i.color || '')).includes(
                      query.trim(),
                    ),
                  )
                  .map((item) => {
                    const checked = chosen(open).includes(item.id);
                    return (
                      <article
                        key={item.id}
                        className={`catalog-pick ${open === 'runes' ? `rune-color-${item.color}` : ''} ${checked ? 'is-selected' : ''}`}
                      >
                        <Checkbox
                          aria-label={`选择${item.name}`}
                          checked={checked}
                          disabled={
                            !editable ||
                            disabled ||
                            (!checked &&
                              (chosen(open).length >=
                                (open === 'glyphs' ? 6 : 30) ||
                                (open === 'runes' &&
                                  colorCount(item.color) >= 10)))
                          }
                          onCheckedChange={(v) => pick(open, item, !!v)}
                        />
                        <span>
                          {open === 'glyphs' ? (
                            <Button
                              variant="ghost"
                              className="glyph-catalog-button"
                              onClick={() => setInspecting(item)}
                              aria-label={`查看${item.name}介绍`}
                            >
                              <GlyphIcon item={item} />
                              <span>
                                <strong>{item.name}</strong>
                                <span
                                  className={`glyph-grade-badge glyph-grade-${glyphGrade(item.color)}`}
                                >
                                  {glyphGrade(item.color)}
                                </span>
                                <small className="glyph-category">
                                  {item.color}
                                </small>
                                <span className="glyph-preview">
                                  {item.effect}
                                </span>
                                <small className="glyph-detail-hint">
                                  查看完整效果 ›
                                </small>
                              </span>
                            </Button>
                          ) : (
                            <>
                              <strong>
                                {item.name}{' '}
                                {open === 'runes' && (
                                  <small
                                    className={`rune-color-label rune-color-${item.color}`}
                                  >
                                    <span
                                      className="rune-jewel"
                                      aria-hidden="true"
                                    />
                                    {item.color}
                                  </small>
                                )}
                              </strong>
                              <span className="preserve">{item.effect}</span>
                              {item.usage && <small>{item.usage}</small>}
                            </>
                          )}
                        </span>
                      </article>
                    );
                  })}
                {!items(open).length && !libraryLoading && (
                  <div className="empty-inline">
                    {open === 'glyphs'
                      ? '暂无雕文条目。'
                      : '铭文资料尚待确认。'}
                    编辑成员也可先在资料库中新增名称与属性。
                  </div>
                )}
              </div>
              <div className="button-row catalog-dialog-bottom">
                {editable && (
                  <Button
                    variant="outline"
                    className="touch"
                    onClick={() => {
                      setOpen(null);
                      onManage?.();
                    }}
                  >
                    编辑资料库
                  </Button>
                )}
                <Button className="touch" onClick={() => setOpen(null)}>
                  {editable ? '完成选择' : '关闭资料库'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!inspecting}
        onOpenChange={(v) => {
          if (!v) setInspecting(null);
        }}
      >
        <DialogContent
          className="talent-detail-editor glyph-detail-dialog"
          showCloseButton={false}
        >
          {inspecting && (
            <>
              <DialogHeader>
                <div className="glyph-detail-heading">
                  <GlyphIcon item={inspecting} />
                  <div>
                    <DialogTitle>{inspecting.name}</DialogTitle>
                    <span className="glyph-category">
                      {inspecting.color || '模式雕文'}
                    </span>
                  </div>
                </div>
                <DialogDescription>无尽守御 · 雕文效果</DialogDescription>
              </DialogHeader>
              <div className="detail-edit-fields">
                <section className="glyph-detail-effect">
                  <h3>具体效果</h3>
                  <p className="preserve">{inspecting.effect}</p>
                </section>
                {inspecting.usage && (
                  <section className="glyph-detail-notes">
                    <h3>使用说明与资料差异</h3>
                    <p className="preserve">{inspecting.usage}</p>
                  </section>
                )}
                {inspecting.image && (
                  <details className="glyph-source-card" open>
                    <summary>查看原始资料卡</summary>
                    <img
                      src={inspecting.image}
                      alt={`${inspecting.name}资料卡`}
                      referrerPolicy="no-referrer"
                    />
                  </details>
                )}
              </div>
              <div className="button-row catalog-dialog-bottom">
                {editable && (
                  <Button
                    className="touch"
                    disabled={
                      disabled ||
                      (!chosen('glyphs').includes(inspecting.id) &&
                        chosen('glyphs').length >= 6)
                    }
                    onClick={() =>
                      pick(
                        'glyphs',
                        inspecting,
                        !chosen('glyphs').includes(inspecting.id),
                      )
                    }
                  >
                    {chosen('glyphs').includes(inspecting.id)
                      ? '从搭配移除'
                      : chosen('glyphs').length >= 6
                        ? '已选满6个'
                        : '加入雕文搭配'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="touch"
                  onClick={() => setInspecting(null)}
                >
                  关闭介绍
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
