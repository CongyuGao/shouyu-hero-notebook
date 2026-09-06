'use client';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Pencil,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { GameIcon } from './game-icon';
import { TierGuide } from './tier-guide';
import { initialPrimer, validatePrimer, type Primer } from '@/lib/primer';
import { readResponse } from '@/lib/client-api';
export function GuidePrimer({ editable = false }: { editable?: boolean }) {
  const [primer, setPrimer] = useState<Primer>(initialPrimer),
    [draft, setDraft] = useState<Primer>(initialPrimer),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/primer')
      .then((r) => readResponse<Primer>(r))
      .then((p) => {
        if (active) {
          setPrimer(p);
          setDraft(p);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(primer);
  async function edit() {
    setBusy(true);
    setError('');
    try {
      const p = await readResponse<Primer>(await fetch('/api/primer'));
      setPrimer(p);
      setDraft(structuredClone(p));
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setError('');
    try {
      const value = validatePrimer(draft);
      setBusy(true);
      const r = await fetch('/api/primer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...value, expectedRevision: primer.revision }),
      });
      const saved = await readResponse<Primer>(r);
      setPrimer(saved);
      setDraft(saved);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, offset: number) {
    const sections = [...draft.sections];
    const target = index + offset;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    setDraft({ ...draft, sections });
  }
  return (
    <article className="primer-page">
      <section className="intro">
        <div>
          <p className="eyebrow">守御手册 · 开篇</p>
          <h1>{primer.title}</h1>
          <p className="muted preserve">{primer.intro}</p>
        </div>
        {editable && (
          <Button
            className="touch"
            variant="outline"
            disabled={loading || busy}
            onClick={() => void edit()}
          >
            <Pencil size={16} />
            编辑 / 添加前瞻
          </Button>
        )}
      </section>
      {error && !open && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="primer-chapters">
        {primer.sections.map((section, i) => (
          <section key={section.id} className="primer-chapter">
            <header>
              <span className="primer-chapter-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              {section.kind === 'note' ? (
                <BookOpen size={25} />
              ) : (
                <GameIcon kind={section.kind === 'glyph' ? 'glyph' : 'core'} />
              )}
              <h2>{section.title}</h2>
            </header>
            <p className="preserve">{section.body}</p>
            {section.source && (
              <p className="primer-source">资料来源：{section.source}</p>
            )}
            {section.kind === 'tier' && <TierGuide editable={editable} />}
          </section>
        ))}
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value && !busy) {
            if (dirty)
              setError('有未保存的内容，请保存公开，或点击“放弃修改”。');
            else setOpen(false);
          }
        }}
      >
        <DialogContent
          className="loadout-dialog primer-editor"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>编辑阅读前瞻</DialogTitle>
            <DialogDescription>
              这是独立于英雄攻略的一级内容。可以新增模式常识和须知、调整顺序，保存后所有玩家可读。
            </DialogDescription>
          </DialogHeader>
          <div className="detail-edit-fields">
            <label className="field" htmlFor="primer-title">
              <span>前瞻标题</span>
              <Input
                id="primer-title"
                maxLength={100}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="field" htmlFor="primer-intro">
              <span>开篇介绍</span>
              <Textarea
                id="primer-intro"
                maxLength={2000}
                value={draft.intro}
                onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
              />
            </label>
            {draft.sections.map((section, i) => (
              <section className="primer-edit-section" key={section.id}>
                <div className="primer-edit-actions">
                  <strong>章节 {i + 1}</strong>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="touch"
                    disabled={busy || i === 0}
                    aria-label={`上移${section.title}`}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="touch"
                    disabled={busy || i === draft.sections.length - 1}
                    aria-label={`下移${section.title}`}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="touch"
                    disabled={busy || draft.sections.length === 1}
                    aria-label={`移除${section.title}，保存后生效`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        sections: draft.sections.filter(
                          (s) => s.id !== section.id,
                        ),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                {(['title', 'body', 'source'] as const).map((key) => (
                  <label
                    className="field"
                    htmlFor={`primer-${section.id}-${key}`}
                    key={key}
                  >
                    <span>
                      {
                        {
                          title: '章节标题',
                          body: '正文 / 常识 / 必要须知',
                          source: '来源与适用版本（选填）',
                        }[key]
                      }
                    </span>
                    {key === 'body' ? (
                      <Textarea
                        id={`primer-${section.id}-${key}`}
                        rows={7}
                        maxLength={6000}
                        value={section[key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            sections: draft.sections.map((s) =>
                              s.id === section.id
                                ? { ...s, [key]: e.target.value }
                                : s,
                            ),
                          })
                        }
                      />
                    ) : (
                      <Input
                        id={`primer-${section.id}-${key}`}
                        maxLength={key === 'title' ? 100 : 1000}
                        value={section[key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            sections: draft.sections.map((s) =>
                              s.id === section.id
                                ? { ...s, [key]: e.target.value }
                                : s,
                            ),
                          })
                        }
                      />
                    )}
                  </label>
                ))}
              </section>
            ))}
            <Button
              className="touch"
              variant="outline"
              disabled={busy || draft.sections.length >= 24}
              onClick={() =>
                setDraft({
                  ...draft,
                  sections: [
                    ...draft.sections,
                    {
                      id: crypto.randomUUID(),
                      kind: 'note',
                      title: '',
                      body: '',
                      source: '',
                    },
                  ],
                })
              }
            >
              <Plus />
              添加常识 / 须知章节
            </Button>
            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              className="touch"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setDraft(primer);
                setError('');
              }}
            >
              {dirty ? '放弃修改' : '关闭'}
            </Button>
            <Button
              className="touch"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? '正在保存…' : '保存并公开前瞻'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
