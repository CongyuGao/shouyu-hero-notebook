'use client';
import { useState } from 'react';
import { Pencil, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { readResponse } from '@/lib/client-api';
import {
  validateCatalog,
  validateRuneColors,
  runeColors,
  glyphGrade,
  glyphGrades,
  type Catalog,
  type CatalogKind,
  type CatalogItem,
  type Libraries,
} from '@/lib/catalog';
export function CatalogEditor({
  libraries,
  onSaved,
  disabled = false,
}: {
  libraries: Libraries;
  onSaved: (v: Catalog) => void;
  disabled?: boolean;
}) {
  const [kind, setKind] = useState<CatalogKind>('glyphs'),
    [editing, setEditing] = useState<CatalogItem | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [query, setQuery] = useState('');
  const [grade, setGrade] = useState('全部');
  async function save() {
    if (!editing || busy || disabled) return;
    setMessage('');
    try {
      const items = validateCatalog([
        ...libraries[kind].items.filter((i) => i.id !== editing.id),
        editing,
      ]);
      if (kind === 'runes') validateRuneColors(items);
      setBusy(true);
      const r = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          items,
          expectedRevision: libraries[kind].revision,
        }),
      });
      const data = await readResponse<Catalog>(r);
      onSaved(data);
      setEditing(null);
      setMessage('资料库已保存。回到流派搭配中选择，或同步本篇属性。');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-section catalog-editor">
      <h2>共享雕文 / 铭文库</h2>
      <p className="muted">
        所有英雄共用。可修改名称、属性和使用说明；保存资料库后公开可读，已发布攻略保留原来的属性，需重新同步并发布。
      </p>
      <Tabs
        value={kind}
        onValueChange={(v) => {
          setKind(v as CatalogKind);
          setQuery('');
          setGrade('全部');
          setMessage('');
        }}
      >
        <TabsList className="build-tabs">
          <TabsTrigger value="glyphs">
            雕文库 · {libraries.glyphs.items.length}
          </TabsTrigger>
          <TabsTrigger value="runes">
            铭文库 · {libraries.runes.items.length}
          </TabsTrigger>
        </TabsList>
        {(['glyphs', 'runes'] as const).map((k) => (
          <TabsContent key={k} value={k}>
            <div className="catalog-toolrow">
              <div className="searchbox">
                <Search size={18} />
                <Input
                  placeholder="搜索名称或属性"
                  aria-label="搜索共享资料库"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button
                className="touch"
                disabled={disabled || libraries[k].items.length >= 240}
                onClick={() => {
                  setMessage('');
                  setEditing({
                    id: crypto.randomUUID(),
                    name: '',
                    effect: '',
                    usage: '',
                    source: '',
                    color: k === 'runes' ? '红色' : '初级秘法',
                  });
                }}
              >
                <Plus />
                新增{k === 'glyphs' ? '雕文' : '铭文'}
              </Button>
            </div>
            {k === 'glyphs' && (
              <div className="glyph-grade-filters" aria-label="按等级管理雕文">
                {['全部', ...glyphGrades, '未分级'].map((value) => (
                  <Button
                    key={value}
                    className={`touch glyph-grade-${value}`}
                    variant="outline"
                    aria-pressed={grade === value}
                    onClick={() => setGrade(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            )}
            {!libraries[k].items.length && (
              <p className="empty-inline">
                {k === 'glyphs'
                  ? '暂无雕文条目，可以手动录入真实资料。'
                  : '铭文库暂为空，待确认资料后录入。'}
              </p>
            )}
            <div className="catalog-management-list">
              {libraries[k].items
                .filter(
                  (i) =>
                    k !== 'glyphs' ||
                    grade === '全部' ||
                    glyphGrade(i.color) === grade,
                )
                .filter((i) => (i.name + i.effect).includes(query.trim()))
                .map((item) => (
                  <article key={item.id}>
                    <div>
                      <h3>
                        {item.name}{' '}
                        {k === 'glyphs' && (
                          <span
                            className={`glyph-grade-badge glyph-grade-${glyphGrade(item.color)}`}
                          >
                            {glyphGrade(item.color)}
                          </span>
                        )}
                        {k === 'runes' && (
                          <span
                            className={`rune-color-label rune-color-${item.color}`}
                          >
                            {item.color}
                          </span>
                        )}
                      </h3>
                      <p className="preserve">{item.effect}</p>
                      {item.usage && (
                        <p className="muted preserve">{item.usage}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="touch"
                      disabled={disabled}
                      onClick={() => {
                        setMessage('');
                        setEditing({ ...item });
                      }}
                    >
                      <Pencil size={16} />
                      编辑
                    </Button>
                  </article>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      {message && !editing && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v && !busy) setEditing(null);
        }}
      >
        <DialogContent className="talent-detail-editor" showCloseButton={false}>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {kind === 'glyphs' ? '雕文资料' : '铭文资料'}
                </DialogTitle>
                <DialogDescription>
                  保存会更新共享资料库，不会替换已经发布的攻略。
                </DialogDescription>
              </DialogHeader>
              <div className="detail-edit-fields">
                {(
                  [
                    ['name', '名称', 60],
                    ['effect', '属性 / 效果', 2500],
                    ['usage', '适配与使用说明', 2500],
                    ['source', '资料来源 / 版本', 500],
                    ['color', '类别 / 颜色（选填）', 30],
                    ['icon', '独立图标链接（选填）', 500],
                    ['image', '原始资料卡图片（选填）', 500],
                  ] as const
                ).map(([key, label, max]) => (
                  <label className="field" key={key}>
                    <span>
                      {key === 'color'
                        ? kind === 'runes'
                          ? '铭文颜色（必选）'
                          : '雕文等级'
                        : label}
                    </span>
                    {key === 'color' && kind === 'runes' ? (
                      <Select
                        value={editing.color || ''}
                        disabled={busy}
                        onValueChange={(v) =>
                          setEditing({ ...editing, color: String(v) })
                        }
                      >
                        <SelectTrigger aria-label="铭文颜色">
                          <SelectValue>
                            {editing.color || '请选择颜色'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {runeColors.map((color) => (
                            <SelectItem key={color} value={color}>
                              <span
                                className={`rune-color-label rune-color-${color}`}
                              >
                                {color}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : key === 'color' ? (
                      <Select
                        value={editing.color || 'ungraded'}
                        disabled={busy}
                        onValueChange={(v) =>
                          setEditing({
                            ...editing,
                            color: v === 'ungraded' ? '' : String(v),
                          })
                        }
                      >
                        <SelectTrigger aria-label="雕文等级">
                          <SelectValue>
                            {editing.color
                              ? `${glyphGrade(editing.color)} · ${editing.color}`
                              : '未分级'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {['初级秘法', '中级秘法', '高级秘法'].map(
                            (value, i) => (
                              <SelectItem key={value} value={value}>
                                {glyphGrades[i]} · {value}
                              </SelectItem>
                            ),
                          )}
                          <SelectItem value="ungraded">未分级</SelectItem>
                          {editing.color &&
                            !['初级秘法', '中级秘法', '高级秘法'].includes(
                              editing.color,
                            ) && (
                              <SelectItem value={editing.color}>
                                {editing.color}（已有分类）
                              </SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    ) : key === 'effect' || key === 'usage' ? (
                      <Textarea
                        disabled={busy}
                        rows={4}
                        maxLength={max}
                        value={editing[key] || ''}
                        onChange={(e) =>
                          setEditing({ ...editing, [key]: e.target.value })
                        }
                      />
                    ) : (
                      <Input
                        disabled={busy}
                        maxLength={max}
                        value={editing[key] || ''}
                        onChange={(e) =>
                          setEditing({ ...editing, [key]: e.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
                {message && (
                  <p className="notice" role="alert">
                    {message}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="touch"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  取消
                </Button>
                <Button
                  className="touch"
                  disabled={busy || disabled}
                  onClick={save}
                >
                  {busy ? '正在保存…' : '保存到共享库'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
