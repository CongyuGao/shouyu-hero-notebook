'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Save,
  Send,
  Plus,
  Download,
  Upload,
  Eye,
  X,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  blankGuide,
  blankBuild,
  heroes,
  priorities,
  validateGuide,
  type Guide,
  type GuideRecord,
  type Build,
  type Priority,
  type Hero,
} from '@/lib/guide';
import { GuideView } from './guide-view';
import { readResponse } from '@/lib/client-api';
import { registerTools } from '@/lib/webmcp';

export function GuideEditor({
  record,
  onClose,
  onSaved,
}: {
  record: GuideRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [doc, setDoc] = useState<Guide>(() =>
    structuredClone(record?.draft || record?.published || blankGuide()),
  );
  const [revision, setRevision] = useState(record?.revision || 0);
  const [saved, setSaved] = useState(() =>
    JSON.stringify(record?.draft || record?.published || doc),
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState<'close' | 'unpublish' | null>(null),
    [preview, setPreview] = useState(false),
    [buildId, setBuildId] = useState(doc.builds[0].id),
    [hasPublished, setHasPublished] = useState(!!record?.published),
    [history, setHistory] = useState<
      Array<{
        revision: number;
        snapshot: string;
        action: string;
        createdAt: string;
      }>
    >([]);
  const dirty = JSON.stringify(doc) !== saved;
  const hero = heroes.find((h) => h.id === doc.heroId);
  const current = doc.builds.find((b) => b.id === buildId) || doc.builds[0];
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  const patch = (values: Partial<Guide>) =>
    setDoc((d) => ({ ...d, ...values }));
  function patchBuild(values: Partial<Build>) {
    setDoc((d) => ({
      ...d,
      builds: d.builds.map((b) =>
        b.id === current.id ? { ...b, ...values } : b,
      ),
    }));
  }
  function patchPick(
    talentId: string,
    values: { priority?: Priority; reason?: string },
  ) {
    const old = current.picks.find((p) => p.talentId === talentId) || {
      talentId,
      priority: 'none' as Priority,
      reason: '',
    };
    patchBuild({
      picks: [
        ...current.picks.filter((p) => p.talentId !== talentId),
        { ...old, ...values },
      ],
    });
  }
  async function save(action: 'draft' | 'publish' | 'unpublish') {
    if (busy) return { ok: false, error: '正在保存，请稍后再试' };
    setMessage('');
    let checked: Guide;
    try {
      checked = validateGuide(doc, action === 'publish');
    } catch (e) {
      setMessage((e as Error).message);
      return { ok: false, error: (e as Error).message };
    }
    setBusy(true);
    try {
      const response = await fetch('/api/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc: checked,
          action,
          expectedRevision: revision,
        }),
      });
      const data = await readResponse<{ revision: number }>(response);
      // Preserve any import or staged edit that completed after this save began.
      const submittedOriginal = JSON.stringify(doc);
      setDoc((current) =>
        JSON.stringify(current) === submittedOriginal ? checked : current,
      );
      setRevision(data.revision);
      setSaved(JSON.stringify(checked));
      if (action !== 'draft') setHasPublished(action === 'publish');
      setMessage(
        action === 'publish'
          ? '攻略已发布，所有人都可以阅读。'
          : action === 'unpublish'
            ? '已撤下公开攻略，草稿仍保留。'
            : '草稿已保存；公开版本不会受影响。',
      );
      await onSaved();
      return { ok: true, revision: data.revision };
    } catch (e) {
      setMessage((e as Error).message);
      return { ok: false, error: (e as Error).message };
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  const toolState = useRef({ doc, revision, busy, save });
  toolState.current = { doc, revision, busy, save };
  useEffect(
    () =>
      registerTools([
        {
          name: 'read_current_guide_draft',
          title: '读取正在编辑的攻略',
          description:
            'Read the current unsaved guide document in the visible editor.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: () => ({
            guide: toolState.current.doc,
            revision: toolState.current.revision,
          }),
        },
        {
          name: 'stage_current_guide_draft',
          title: '填入攻略编辑区',
          description:
            'Replace the visible unsaved draft with a validated guide. Does not save or publish. Use only after the user asks to fill or replace this draft.',
          inputSchema: {
            type: 'object',
            properties: { guide: { type: 'object' } },
            required: ['guide'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: (input) => {
            const s = toolState.current;
            if (s.busy) throw new Error('Save in progress');
            const value = validateGuide((input as { guide: unknown }).guide);
            if (s.revision > 0 && value.heroId !== s.doc.heroId)
              throw new Error('Cannot change hero of saved guide');
            setDoc(value);
            setBuildId(value.builds[0].id);
            return { heroId: value.heroId, status: 'staged, not saved' };
          },
        },
        {
          name: 'save_current_guide_draft',
          title: '保存当前攻略草稿',
          description:
            'Persist the visible guide as an editor-only draft using the same save operation and permission checks as the Save Draft button. Does not publish.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: async () => {
            const r = await toolState.current.save('draft');
            if (!r?.ok) throw new Error(r?.error || 'Save failed');
            return r;
          },
        },
      ]),
    [],
  );
  function download(value: Guide = doc) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${heroes.find((h) => h.id === value.heroId)?.name || '英雄'}-天赋攻略.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 180000) throw new Error('文件过大，最多180 KB');
      const d = validateGuide(JSON.parse(await file.text()));
      if (revision > 0 && d.heroId !== doc.heroId)
        throw new Error('不能用其他英雄的攻略覆盖当前英雄');
      setDoc(d);
      setBuildId(d.builds[0].id);
      setMessage('内容已导入编辑区，请检查后保存；尚未覆盖已保存内容。');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function loadHistory() {
    try {
      const r = await fetch(`/api/history?heroId=${doc.heroId}`);
      const j = await readResponse<
        Array<{
          revision: number;
          snapshot: string;
          action: string;
          createdAt: string;
        }>
      >(r);
      setHistory(j);
      if (!j.length) setMessage('暂时没有保存记录。');
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open && !busy) {
            if (dirty) setConfirm('close');
            else onClose();
          }
        }}
      >
        <SheetContent className="editor-sheet" showCloseButton={false}>
          <SheetHeader className="editor-head">
            <div>
              <SheetTitle>
                {hero ? `${hero.name} · 编写攻略` : '收录一位模式英雄'}
              </SheetTitle>
              <SheetDescription>
                {dirty ? '有未保存的修改' : '草稿仅编辑成员可见'} ·{' '}
                {revision ? `修订 ${revision}` : '尚未保存'}
              </SheetDescription>
            </div>
            <div className="button-row">
              <Button
                className="touch"
                variant="ghost"
                disabled={!hero}
                onClick={() => setPreview(!preview)}
              >
                <Eye />
                {preview ? '继续编辑' : '预览'}
              </Button>
              <Button
                variant="ghost"
                className="touch"
                aria-label="关闭编辑"
                disabled={busy}
                onClick={() => (dirty ? setConfirm('close') : onClose())}
              >
                <X />
              </Button>
            </div>
          </SheetHeader>
          <div className="editor-scroll">
            <fieldset disabled={busy} className="editor-form">
              {preview && hero ? (
                <GuideView
                  guide={doc}
                  record={{
                    heroId: doc.heroId,
                    revision,
                    updatedAt: '',
                    publishedAt: null,
                    published: null,
                  }}
                  onBack={() => setPreview(false)}
                />
              ) : (
                <Tabs defaultValue="talents">
                  <TabsList className="editor-tabs">
                    <TabsTrigger value="talents">① 核心与天赋</TabsTrigger>
                    <TabsTrigger value="builds">② 流派搭配</TabsTrigger>
                    <TabsTrigger value="glyphs">③ 雕文介绍</TabsTrigger>
                    <TabsTrigger value="publish">④ 发布信息</TabsTrigger>
                  </TabsList>
                  <TabsContent value="talents">
                    <section className="form-section">
                      <h2>先确认，这是无尽守御的可用英雄</h2>
                      <p className="muted">
                        名称与头像选自官网目录。只有你确认并发布的英雄才会出现在首页。
                      </p>
                      <label className="field-label">英雄</label>
                      <Combobox<Hero>
                        items={heroes}
                        value={hero || null}
                        disabled={revision > 0}
                        itemToStringLabel={(h) => h.name}
                        onValueChange={(h) => {
                          if (h)
                            patch({
                              heroId: h.id,
                              title: doc.title || `${h.name} · 天赋流派攻略`,
                            });
                        }}
                      >
                        <ComboboxInput
                          aria-label="选择无尽守御英雄"
                          placeholder="输入英雄名称"
                          className="hero-picker"
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>没有找到英雄</ComboboxEmpty>
                          <ComboboxList>
                            {(h: Hero) => (
                              <ComboboxItem key={h.id} value={h}>
                                {h.name} · {h.roles.join('/')}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      <Field
                        label="攻略标题"
                        value={doc.title}
                        onChange={(v) => patch({ title: v })}
                        placeholder="例如：英雄名 · 两种核心流派的天赋取舍"
                        max={100}
                      />
                      <Field
                        label="攻略简介"
                        value={doc.intro}
                        onChange={(v) => patch({ intro: v })}
                        multiline
                        placeholder="适合什么玩家、解决什么问题，有哪些前提条件。"
                        max={2400}
                      />
                    </section>
                    <section className="form-section">
                      <h2>流派核心 · 原始效果</h2>
                      {!(doc.cores || []).length && (
                        <Button
                          variant="outline"
                          className="touch"
                          onClick={() =>
                            patch({ cores: blankGuide(doc.heroId).cores })
                          }
                        >
                          创建6个核心栏位
                        </Button>
                      )}
                      <p className="muted">
                        按技能录入核心；在“流派搭配”中选择这个打法用哪一个。
                      </p>
                      <div className="talent-edit-grid">
                        {(doc.cores || []).map((c) => (
                          <div className="talent-edit" key={c.id}>
                            <span className="talent-number">
                              {c.skill} 技能核心
                            </span>
                            <Field
                              label="核心名称"
                              value={c.name}
                              max={60}
                              onChange={(v) =>
                                patch({
                                  cores: doc.cores.map((x) =>
                                    x.id === c.id ? { ...x, name: v } : x,
                                  ),
                                })
                              }
                            />
                            <Field
                              label="核心效果"
                              value={c.description}
                              max={2000}
                              multiline
                              onChange={(v) =>
                                patch({
                                  cores: doc.cores.map((x) =>
                                    x.id === c.id
                                      ? { ...x, description: v }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="form-section">
                      <div className="section-caption">
                        <h2>{doc.talents.length} 个小天赋</h2>
                        <span>
                          {doc.talents.filter((t) => t.name).length}/
                          {doc.talents.length} 已填写
                        </span>
                      </div>
                      <p className="muted">
                        按游戏内顺序录入。暂不清楚的效果可留空，不填推测数值。
                      </p>
                      <div className="talent-edit-grid">
                        {doc.talents.map((t, i) => (
                          <div className="talent-edit" key={t.id}>
                            <span className="talent-number">
                              {t.skill ? `${t.skill} 技能 · ` : ''}
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <Field
                              label={`天赋 ${i + 1} 名称`}
                              value={t.name}
                              onChange={(v) =>
                                patch({
                                  talents: doc.talents.map((x) =>
                                    x.id === t.id ? { ...x, name: v } : x,
                                  ),
                                })
                              }
                              placeholder="游戏内名称"
                              max={60}
                            />
                            <Field
                              label="天赋效果"
                              value={t.description}
                              onChange={(v) =>
                                patch({
                                  talents: doc.talents.map((x) =>
                                    x.id === t.id
                                      ? { ...x, description: v }
                                      : x,
                                  ),
                                })
                              }
                              multiline
                              placeholder="效果、数值、等级变化或触发条件"
                              max={1600}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="button-row slot-actions">
                        <Button
                          variant="outline"
                          className="touch"
                          disabled={doc.talents.length >= 36}
                          onClick={() => {
                            const i = doc.talents.length;
                            patch({
                              talents: [
                                ...doc.talents,
                                {
                                  id: `t${String(i + 1).padStart(2, '0')}`,
                                  name: '',
                                  description: '',
                                },
                              ],
                            });
                          }}
                        >
                          增加一个栏位
                        </Button>
                        <Button
                          variant="ghost"
                          className="touch"
                          disabled={
                            doc.talents.length <= 1 ||
                            !!doc.talents.at(-1)?.name ||
                            !!doc.talents.at(-1)?.description ||
                            doc.builds.some((b) =>
                              b.picks.some(
                                (p) =>
                                  p.talentId === doc.talents.at(-1)?.id &&
                                  p.priority !== 'none',
                              ),
                            )
                          }
                          onClick={() => {
                            const id = doc.talents.at(-1)!.id;
                            patch({
                              talents: doc.talents.slice(0, -1),
                              builds: doc.builds.map((b) => ({
                                ...b,
                                picks: b.picks.filter((p) => p.talentId !== id),
                              })),
                            });
                          }}
                        >
                          移除末尾空栏位
                        </Button>
                      </div>
                    </section>
                  </TabsContent>
                  <TabsContent value="builds">
                    <section className="form-section">
                      <div className="section-caption">
                        <h2>流派搭配与攻略</h2>
                        <Button
                          variant="outline"
                          className="touch"
                          disabled={doc.builds.length >= 8}
                          onClick={() => {
                            const b = blankBuild();
                            patch({ builds: [...doc.builds, b] });
                            setBuildId(b.id);
                          }}
                        >
                          <Plus />
                          添加流派
                        </Button>
                      </div>
                      <Tabs
                        value={current.id}
                        onValueChange={(v) => setBuildId(String(v))}
                      >
                        <TabsList className="build-tabs">
                          {doc.builds.map((b, i) => (
                            <TabsTrigger key={b.id} value={b.id}>
                              {b.name || `流派 ${i + 1}`}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                      <Field
                        label="流派名称"
                        value={current.name}
                        onChange={(v) => patchBuild({ name: v })}
                        placeholder="写出这个流派的核心机制"
                        max={70}
                      />
                      <Field
                        label="核心思路与适用场景"
                        value={current.summary}
                        onChange={(v) => patchBuild({ summary: v })}
                        multiline
                        placeholder="主要靠什么打伤害或守御？适合哪些阵容、局面？"
                        max={2000}
                      />
                      <Field
                        label="天赋选择顺序"
                        value={current.order}
                        onChange={(v) => patchBuild({ order: v })}
                        multiline
                        placeholder="先拿什么，再补什么；没有刷到核心天赋时如何过渡。"
                        max={2000}
                      />
                      <h3 className="subheading">选择本流派核心</h3>
                      <div className="core-choice-grid">
                        {[1, 2, 3].map((skill) => (
                          <div className="core-choice" key={skill}>
                            <strong>{skill} 技能核心</strong>
                            {(doc.cores || [])
                              .filter((c) => c.skill === skill && c.name)
                              .map((c) => (
                                <label key={c.id} className="choice-card">
                                  <Checkbox
                                    checked={(current.coreIds || []).includes(
                                      c.id,
                                    )}
                                    onCheckedChange={(v) =>
                                      patchBuild({
                                        coreIds: v
                                          ? [
                                              ...(current.coreIds || []).filter(
                                                (id) =>
                                                  doc.cores.find(
                                                    (x) => x.id === id,
                                                  )?.skill !== skill,
                                              ),
                                              c.id,
                                            ]
                                          : (current.coreIds || []).filter(
                                              (id) => id !== c.id,
                                            ),
                                      })
                                    }
                                  />
                                  <span>
                                    <strong>{c.name}</strong>
                                    <small>
                                      {c.description || '效果待补充'}
                                    </small>
                                  </span>
                                </label>
                              ))}
                            {!(doc.cores || []).some(
                              (c) => c.skill === skill && c.name,
                            ) && (
                              <p className="muted">
                                先在“核心与天赋”填写名称。
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <h3 className="subheading">逐项写下你的推荐</h3>
                      <p className="muted">
                        每个流派独立评价，不同流派可以对同一个天赋给出不同建议。
                      </p>
                      <div className="pick-edit-list">
                        {doc.talents.map((t, i) => {
                          const p = current.picks.find(
                            (p) => p.talentId === t.id,
                          );
                          return (
                            <div key={t.id} className="pick-edit">
                              <div className="pick-edit-top">
                                <strong>
                                  <span>{String(i + 1).padStart(2, '0')}</span>
                                  {t.name || '未填写名称'}
                                </strong>
                                <Select
                                  value={p?.priority || 'none'}
                                  onValueChange={(v) =>
                                    patchPick(t.id, { priority: v as Priority })
                                  }
                                >
                                  <SelectTrigger
                                    aria-label={`${t.name || `天赋${i + 1}`}推荐等级`}
                                  >
                                    <SelectValue>
                                      {priorities[p?.priority || 'none']}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(priorities).map(
                                      ([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                          {label}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              {p && p.priority !== 'none' && (
                                <Field
                                  label="选择或放弃的理由"
                                  value={p.reason}
                                  onChange={(v) =>
                                    patchPick(t.id, { reason: v })
                                  }
                                  multiline
                                  placeholder="说明与流派的关联、收益、触发条件或替代方案。"
                                  max={1200}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <h3 className="subheading">选择本流派雕文</h3>
                      <p className="muted">
                        先在“雕文介绍”录入，再在这里勾选。不同流派独立保存。
                      </p>
                      {doc.glyphs.length ? (
                        <div className="glyph-choice-grid">
                          {doc.glyphs.map((g) => (
                            <label className="choice-card" key={g.id}>
                              <Checkbox
                                checked={(current.glyphIds || []).includes(
                                  g.id,
                                )}
                                onCheckedChange={(v) =>
                                  patchBuild({
                                    glyphIds: v
                                      ? [
                                          ...(current.glyphIds || []).filter(
                                            (id) => id !== g.id,
                                          ),
                                          g.id,
                                        ]
                                      : (current.glyphIds || []).filter(
                                          (id) => id !== g.id,
                                        ),
                                  })
                                }
                              />
                              <span>
                                <strong>{g.name || '未命名雕文'}</strong>
                                <small>{g.effect || '效果待补充'}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="empty-inline">
                          尚未录入雕文，请先打开上方“雕文介绍”。
                        </p>
                      )}
                      <h3 className="subheading">搭配说明与打法（选填）</h3>
                      <Field
                        label="模式专属雕文搭配"
                        value={current.glyphs}
                        onChange={(v) => patchBuild({ glyphs: v })}
                        multiline
                        placeholder="雕文名称、选择顺序、组合效果。这里不是排位装备。"
                        max={3000}
                      />
                      <div className="two-columns">
                        <Field
                          label="铭文"
                          value={current.runes}
                          onChange={(v) => patchBuild({ runes: v })}
                          multiline
                          max={2000}
                        />
                        <Field
                          label="秘法"
                          value={current.arcana}
                          onChange={(v) => patchBuild({ arcana: v })}
                          multiline
                          max={2000}
                        />
                      </div>
                      <Field
                        label="实战打法、队友配合与常见误区"
                        value={current.notes}
                        onChange={(v) => patchBuild({ notes: v })}
                        multiline
                        tall
                        max={8000}
                      />
                      {doc.builds.length > 1 && (
                        <Button
                          variant="destructive"
                          className="touch"
                          onClick={() => {
                            const next = doc.builds.filter(
                              (b) => b.id !== current.id,
                            );
                            patch({ builds: next });
                            setBuildId(next[0].id);
                          }}
                        >
                          <Trash2 />
                          移除此流派（保存后生效）
                        </Button>
                      )}
                    </section>
                  </TabsContent>
                  <TabsContent value="glyphs">
                    <section className="form-section">
                      <div className="section-caption">
                        <h2>模式专属雕文介绍</h2>
                        <Button
                          className="touch"
                          variant="outline"
                          disabled={doc.glyphs.length >= 36}
                          onClick={() =>
                            patch({
                              glyphs: [
                                ...doc.glyphs,
                                {
                                  id: crypto.randomUUID(),
                                  name: '',
                                  effect: '',
                                  usage: '',
                                },
                              ],
                            })
                          }
                        >
                          <Plus />
                          添加雕文
                        </Button>
                      </div>
                      <p className="muted">
                        写清效果与使用条件，让读者理解为什么搭配它。流派里的“雕文搭配”用于讲组合与顺序。
                      </p>
                      {doc.glyphs.length === 0 && (
                        <p className="notice">
                          暂未录入雕文。可以按攻略中用到的雕文逐个补充。
                        </p>
                      )}
                      {doc.glyphs.map((g, i) => (
                        <div className="glyph-edit" key={g.id}>
                          <div className="section-caption">
                            <h3>雕文 {i + 1}</h3>
                            <Button
                              className="touch"
                              variant="ghost"
                              onClick={() =>
                                patch({
                                  glyphs: doc.glyphs.filter(
                                    (x) => x.id !== g.id,
                                  ),
                                  builds: doc.builds.map((b) => ({
                                    ...b,
                                    glyphIds: (b.glyphIds || []).filter(
                                      (id) => id !== g.id,
                                    ),
                                  })),
                                })
                              }
                            >
                              移除
                            </Button>
                          </div>
                          <Field
                            label="雕文名称"
                            value={g.name}
                            max={60}
                            onChange={(v) =>
                              patch({
                                glyphs: doc.glyphs.map((x) =>
                                  x.id === g.id ? { ...x, name: v } : x,
                                ),
                              })
                            }
                          />
                          <Field
                            label="雕文效果"
                            value={g.effect}
                            max={2500}
                            multiline
                            placeholder="准确描述效果、触发条件、等级或数值；不确定处请注明。"
                            onChange={(v) =>
                              patch({
                                glyphs: doc.glyphs.map((x) =>
                                  x.id === g.id ? { ...x, effect: v } : x,
                                ),
                              })
                            }
                          />
                          <Field
                            label="适配流派与使用条件"
                            value={g.usage}
                            max={2500}
                            multiline
                            placeholder="适合哪个核心流派？需要配合哪些天赋？什么情况下不建议选？"
                            onChange={(v) =>
                              patch({
                                glyphs: doc.glyphs.map((x) =>
                                  x.id === g.id ? { ...x, usage: v } : x,
                                ),
                              })
                            }
                          />
                        </div>
                      ))}
                    </section>
                  </TabsContent>
                  <TabsContent value="publish">
                    <section className="form-section">
                      <h2>给读者足够的判断依据</h2>
                      <div className="two-columns">
                        <Field
                          label="游戏版本 / 核验日期"
                          value={doc.version}
                          onChange={(v) => patch({ version: v })}
                          placeholder="例如：2026-09-06 游戏内版本"
                          max={80}
                        />
                        <Field
                          label="作者署名（公开显示）"
                          value={doc.author}
                          onChange={(v) => patch({ author: v })}
                          placeholder="你的游戏昵称或攻略署名"
                          max={60}
                        />
                      </div>
                      <Field
                        label="资料来源 / 实测记录"
                        value={doc.source}
                        onChange={(v) => patch({ source: v })}
                        multiline
                        placeholder="可写游戏内截图日期、实战测试条件，以及原始资料链接。"
                        max={3000}
                      />
                      <label className="checkline">
                        <Checkbox
                          checked={doc.verified}
                          onCheckedChange={(v) =>
                            patch({ verified: v === true })
                          }
                        />
                        <span>
                          我已核对全部核心与{doc.talents.length}
                          个天赋，并在上方记录核验来源
                        </span>
                      </label>
                      <p className="muted">
                        未勾选时，读者会看到“待核验”。发布前必须至少有一个完整的流派推荐。
                      </p>
                    </section>
                    <section className="form-section">
                      <h2>资料导入与备份</h2>
                      <p className="muted">
                        导入会替换当前编辑区，不会自动保存。可以先导出备份。
                      </p>
                      <div className="button-row">
                        <Button
                          variant="outline"
                          className="touch"
                          onClick={() => download()}
                        >
                          <Download />
                          导出当前内容
                        </Button>
                        <label className="file-button">
                          <Upload size={16} />
                          导入 JSON
                          <input
                            type="file"
                            accept="application/json,.json"
                            onChange={(e) => {
                              void importFile(e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </section>
                    {revision > 0 && (
                      <section className="form-section">
                        <h2>历史版本</h2>
                        <Button
                          variant="outline"
                          className="touch"
                          onClick={loadHistory}
                        >
                          查看最近20次保存
                        </Button>
                        {history.map((h) => (
                          <div className="history-row" key={h.revision}>
                            <span>
                              修订 {h.revision} ·{' '}
                              {{
                                draft: '保存草稿',
                                publish: '发布',
                                unpublish: '撤下',
                              }[h.action] || h.action}
                              <small>
                                {new Date(h.createdAt).toLocaleString('zh-CN')}
                              </small>
                            </span>
                            <Button
                              variant="ghost"
                              className="touch"
                              onClick={() => download(JSON.parse(h.snapshot))}
                            >
                              导出此版本
                            </Button>
                          </div>
                        ))}
                      </section>
                    )}
                    {hasPublished && (
                      <section className="form-section">
                        <h2>撤下公开攻略</h2>
                        <p className="muted">
                          撤下后仅编辑成员可见，已保存的草稿和历史版本保留。
                        </p>
                        <Button
                          variant="destructive"
                          className="touch"
                          disabled={busy}
                          onClick={() => setConfirm('unpublish')}
                        >
                          撤下这篇攻略
                        </Button>
                      </section>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </fieldset>
          </div>
          <div className="editor-bottom">
            {message && (
              <p role="status" className="save-message">
                {message}
              </p>
            )}
            <div className="editor-bottom-row">
              <span>
                {dirty ? '修改尚未保存' : '内容已同步'}
                <small>草稿与公开版本分开保存</small>
              </span>
              <div className="button-row">
                <Button
                  variant="outline"
                  className="touch"
                  disabled={busy}
                  onClick={() => save('draft')}
                >
                  <Save />
                  {busy ? '正在保存…' : '存草稿'}
                </Button>
                <Button
                  className="touch"
                  disabled={busy}
                  onClick={() => save('publish')}
                >
                  <Send />
                  发布攻略
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirm === 'close' ? '离开未保存的攻略？' : '撤下公开攻略？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm === 'close'
              ? '未保存的修改将丢失。你可以返回编辑并先保存草稿。'
              : '读者将无法查看这篇攻略，草稿与历史版本仍然保留。'}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>返回编辑</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirm === 'close') onClose();
                else void save('unpublish');
              }}
            >
              {confirm === 'close' ? '放弃修改' : '确认撤下'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
  tall = false,
  placeholder = '',
  max = 2000,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
  tall?: boolean;
  placeholder?: string;
  max?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <Textarea
          value={value}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={tall ? 10 : 3}
        />
      ) : (
        <Input
          value={value}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
