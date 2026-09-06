'use client';
import { useEffect, useState } from 'react';
import {
  Bug,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  RefreshCw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { apiFetch, readResponse } from '@/lib/client-api';
import {
  blankBug,
  bugStatuses,
  emptyBugs,
  MAX_BUGS,
  validateBugEntry,
  type BugEntry,
  type BugLibrary,
  type BugStatus,
} from '@/lib/bugs';

export function BugGuide({ editable = false }: { editable?: boolean }) {
  const [library, setLibrary] = useState<BugLibrary>(emptyBugs);
  const [draft, setDraft] = useState<BugEntry | null>(null);
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = draft !== null && JSON.stringify(draft) !== original;
  useEffect(() => {
    let active = true;
    apiFetch('/api/bugs', { cache: 'no-store' })
      .then(readResponse<BugLibrary>)
      .then((value) => {
        if (active) setLibrary(value);
      })
      .catch((reason) => {
        if (active) setError(reason.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // oxlint-disable-next-line @typescript-eslint/no-deprecated -- Older mobile browsers need returnValue to show the unsaved-content warning.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  async function edit(id?: string) {
    if (!editable || busy) return;
    setBusy(true);
    setError('');
    try {
      const current = await readResponse<BugLibrary>(
        await apiFetch('/api/bugs', { cache: 'no-store' }),
      );
      setLibrary(current);
      const entry = id
        ? current.items.find((item) => item.id === id)
        : blankBug();
      if (!entry) throw new Error('这条记录已不存在，请重新读取列表');
      const copy = structuredClone(entry);
      setOriginal(JSON.stringify(copy));
      setDraft(copy);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setLibrary(
        await readResponse<BugLibrary>(
          await apiFetch('/api/bugs', { cache: 'no-store' }),
        ),
      );
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function save() {
    if (!draft || !editable || busy) return;
    setError('');
    try {
      const entry = validateBugEntry(draft);
      setBusy(true);
      const saved = await readResponse<BugLibrary>(
        await apiFetch('/api/bugs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry, expectedRevision: library.revision }),
        }),
      );
      setLibrary(saved);
      setDraft(null);
      setOriginal('');
      toast.add({
        title: '保存成功',
        description: 'BUG 说明已公开，玩家现在可以查看。',
        type: 'success',
      });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="bug-guide">
      <section className="intro">
        <div>
          <p className="eyebrow">无尽守御 · 异常记录</p>
          <h1>BUG 说明</h1>
          <p className="muted">
            记录遇到的问题、复现条件和临时应对办法。尚未验证的记录标为「待确认」。
          </p>
        </div>
        {editable ? (
          <Button
            className="touch"
            disabled={loading || busy || library.items.length >= MAX_BUGS}
            onClick={() => void edit()}
          >
            <Plus size={18} />
            新增 BUG
          </Button>
        ) : (
          // oxlint-disable-next-line next/no-html-link-for-pages -- Reload the password entry when switching from public read mode to authenticated edit mode.
          <a className="bug-edit-entry" href="/edit?page=bugs">
            <Pencil size={16} />
            验证密码后添加 / 编辑
          </a>
        )}
      </section>
      {error && !draft && (
        <p className="notice" role="alert">
          {error}{' '}
          <Button
            variant="outline"
            className="touch"
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} />
            重新读取
          </Button>
        </p>
      )}
      {loading ? (
        <output className="muted">
          正在读取 BUG 记录…
        </output>
      ) : !error && !library.items.length ? (
        <section className="reference-card bug-placeholder">
          <Bug size={30} />
          <h2>还没有 BUG 记录</h2>
          <p>
            {editable
              ? '点击「新增 BUG」，写下遇到的问题；暂时不能复现也可以先记录。'
              : '攻略团队后续会在这里补充遇到的问题。'}
          </p>
        </section>
      ) : null}
      <div className="bug-records">
        {library.items.map((entry) => (
          <section className="reference-card bug-record" key={entry.id}>
            <header>
              <span
                className={`bug-status bug-status-${bugStatuses.indexOf(entry.status)}`}
              >
                {entry.status === '已修复' ? (
                  <CheckCircle2 size={15} />
                ) : entry.status === '已复现' ? (
                  <Bug size={15} />
                ) : (
                  <Clock3 size={15} />
                )}
                {entry.status}
              </span>
              {editable && (
                <Button
                  variant="outline"
                  className="touch"
                  disabled={busy}
                  onClick={() => void edit(entry.id)}
                  aria-label={`编辑 ${entry.title}`}
                >
                  <Pencil size={15} />
                  编辑
                </Button>
              )}
            </header>
            <h2>{entry.title}</h2>
            <div className="bug-meta">
              {entry.version && <span>适用版本 · {entry.version}</span>}
              {entry.updatedAt && (
                <time dateTime={entry.updatedAt}>
                  更新于{' '}
                  {new Date(entry.updatedAt).toLocaleDateString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                  })}
                </time>
              )}
            </div>
            <p className="preserve bug-body">{entry.body}</p>
            {(entry.scope || entry.steps || entry.workaround) && (
              <details className="bug-detail">
                <summary>复现条件与应对办法</summary>
                {(
                  [
                    ['scope', '相关英雄 / 场景'],
                    ['steps', '复现步骤'],
                    ['workaround', '临时应对办法'],
                  ] as const
                ).map(([key, label]) =>
                  entry[key] ? (
                    <div key={key}>
                      <h3>{label}</h3>
                      <p className="preserve">{entry[key]}</p>
                    </div>
                  ) : null,
                )}
              </details>
            )}
          </section>
        ))}
      </div>
      <Dialog
        open={!!draft}
        onOpenChange={(value) => {
          if (value || busy) return;
          if (dirty) setError('还有未保存的内容，请保存，或点击「放弃修改」。');
          else {
            setDraft(null);
            setError('');
          }
        }}
      >
        <DialogContent
          className="bug-editor scrollable-site-dialog"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>
              {library.items.some((item) => item.id === draft?.id)
                ? '编辑 BUG 说明'
                : '新增 BUG 说明'}
            </DialogTitle>
            <DialogDescription>
              标题和问题现象必填，其余选填。保存后所有玩家可见。
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <>
              {!editable && (
                <p className="notice" role="alert">
                  编辑权限已失效，输入仍保留，请复制后重新验证。
                </p>
              )}
              <fieldset className="detail-edit-fields" disabled={busy}>
                <label className="field" htmlFor="bug-title">
                  <span>BUG 标题</span>
                  <Input
                    id="bug-title"
                    value={draft.title}
                    maxLength={100}
                    placeholder="简要描述遇到的问题"
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                  />
                </label>
                <label className="field" htmlFor="bug-status">
                  <span>确认状态</span>
                  <Select
                    value={draft.status}
                    onValueChange={(status) =>
                      setDraft({ ...draft, status: status as BugStatus })
                    }
                  >
                    <SelectTrigger id="bug-status">
                      <SelectValue>{draft.status}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {bugStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {(
                  [
                    ['body', '问题现象', 6000],
                    ['version', '适用版本（选填）', 100],
                    ['scope', '相关英雄 / 场景（选填）', 300],
                    ['steps', '复现步骤（选填）', 3000],
                    ['workaround', '临时应对办法（选填）', 3000],
                  ] as const
                ).map(([key, label, max]) => (
                  <label className="field" htmlFor={`bug-${key}`} key={key}>
                    <span>{label}</span>
                    {key === 'version' || key === 'scope' ? (
                      <Input
                        id={`bug-${key}`}
                        value={draft[key]}
                        maxLength={max}
                        onChange={(event) =>
                          setDraft({ ...draft, [key]: event.target.value })
                        }
                      />
                    ) : (
                      <Textarea
                        id={`bug-${key}`}
                        rows={key === 'body' ? 5 : 3}
                        value={draft[key]}
                        maxLength={max}
                        onChange={(event) =>
                          setDraft({ ...draft, [key]: event.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
              </fieldset>
              {error && (
                <p className="notice" role="alert">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  className="touch"
                  disabled={busy}
                  onClick={() => {
                    setDraft(null);
                    setOriginal('');
                    setError('');
                  }}
                >
                  {dirty ? '放弃修改' : '取消'}
                </Button>
                <Button
                  className="touch"
                  disabled={busy || !editable}
                  onClick={() => void save()}
                >
                  {busy ? '正在保存…' : '保存并公开'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}
