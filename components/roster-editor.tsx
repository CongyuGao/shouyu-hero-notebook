'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { heroes } from '@/lib/guide';
import {
  rosterHeroIds,
  validateRoster,
  type ModeRoster,
} from '@/lib/mode-roster';
import { apiFetch, readResponse } from '@/lib/client-api';

export function RosterEditor({
  roster,
  onSaved,
}: {
  roster: ModeRoster;
  onSaved: (roster: ModeRoster) => void;
}) {
  const [draft, setDraft] = useState(roster),
    [base, setBase] = useState(roster),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  async function edit() {
    setBusy(true);
    setError('');
    try {
      const latest = await readResponse<ModeRoster>(
        await apiFetch('/api/roster', { cache: 'no-store' }),
      );
      onSaved(latest);
      setBase(latest);
      setDraft(structuredClone(latest));
      setSearch('');
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
      const checked = validateRoster(draft);
      setBusy(true);
      const saved = await readResponse<ModeRoster>(
        await apiFetch('/api/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...checked, expectedRevision: base.revision }),
        }),
      );
      setDraft(saved);
      setBase(saved);
      onSaved(saved);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function assign(id: string, groupId: string) {
    setDraft((d) => ({
      ...d,
      groups: d.groups.map((g) => ({
        ...g,
        heroIds:
          g.id === groupId
            ? [...g.heroIds.filter((v) => v !== id), id]
            : g.heroIds.filter((v) => v !== id),
      })),
    }));
  }
  const members = new Set(rosterHeroIds(draft));
  const candidates = search.trim()
    ? heroes
        .filter(
          (h) =>
            !members.has(h.id) &&
            `${h.name}${h.pinyin}`
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
        )
        .slice(0, 10)
    : [];
  return (
    <>
      <Button
        variant="outline"
        className="touch"
        disabled={busy}
        onClick={() => void edit()}
      >
        <Pencil size={16} /> 管理英雄池 / 轮换
      </Button>
      {error && !open && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && !busy) {
            if (dirty) setError('有未保存的调整，请保存，或点击“放弃修改”。');
            else setOpen(false);
          }
        }}
      >
        <DialogContent
          className="loadout-dialog roster-editor"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>管理模式英雄池</DialogTitle>
            <DialogDescription>
              三个批次每周轮换一批。调整名单不会生成、删除或覆盖英雄攻略；移出名单仅隐藏公开英雄入口。
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy} className="detail-edit-fields">
            <label className="field" htmlFor="roster-intro">
              <span>轮换说明</span>
              <Textarea
                id="roster-intro"
                maxLength={1000}
                value={draft.intro}
                onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
              />
            </label>
            <p className="muted">
              共 {members.size}{' '}
              位英雄。批次名称可写日期；未核实本周名单时请保持中性名称。
            </p>
            {draft.groups.map((group, index) => (
              <section className="roster-edit-group" key={group.id}>
                <label className="field" htmlFor={`batch-${group.id}`}>
                  <span>
                    批次 {index + 1} · {group.heroIds.length} 位
                  </span>
                  <Input
                    id={`batch-${group.id}`}
                    maxLength={40}
                    value={group.name}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        groups: draft.groups.map((g) =>
                          g.id === group.id
                            ? { ...g, name: e.target.value }
                            : g,
                        ),
                      })
                    }
                  />
                </label>
                {group.heroIds.map((id) => {
                  const h = heroes.find((hero) => hero.id === id)!;
                  return (
                    <div className="roster-edit-hero" key={id}>
                      <img
                        src={h.avatar}
                        alt=""
                        width={38}
                        height={38}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <strong>{h.name}</strong>
                      <Select
                        value={group.id}
                        onValueChange={(v) => {
                          if (v) assign(id, String(v));
                        }}
                      >
                        <SelectTrigger aria-label={`${h.name}所属批次`}>
                          <SelectValue>{group.name}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {draft.groups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name || '未命名批次'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        className="touch"
                        size="icon"
                        variant="ghost"
                        aria-label={`将${h.name}移出英雄池，保存后生效`}
                        onClick={() => assign(id, '')}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  );
                })}
              </section>
            ))}
            <section className="roster-edit-group">
              <h3>补充新开放的模式英雄</h3>
              <p className="muted">
                仅在确认加入无尽守御后添加，不会批量导入排位英雄。
              </p>
              <Input
                aria-label="查找需要添加的英雄"
                placeholder="输入准确英雄名，再选择加入的批次"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {candidates.map((h) => (
                <div className="roster-add-hero" key={h.id}>
                  <strong>{h.name}</strong>
                  {draft.groups.map((g) => (
                    <Button
                      key={g.id}
                      variant="outline"
                      className="touch"
                      onClick={() => assign(h.id, g.id)}
                    >
                      <Plus size={13} />
                      {g.name}
                    </Button>
                  ))}
                </div>
              ))}
              {search.trim() && !candidates.length && (
                <p className="muted">
                  没有可添加的匹配英雄，或该英雄已在名单中。
                </p>
              )}
            </section>
            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}
          </fieldset>
          <DialogFooter>
            <Button
              variant="outline"
              className="touch"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setDraft(base);
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
              {busy ? '正在保存…' : '保存并公开英雄池'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
