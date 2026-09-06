'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import Notebook from '@/app/notebook';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, readResponse } from '@/lib/client-api';
export function EditEntry() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = new URLSearchParams(location.hash.slice(1)).get('key');
    // Remove the capability before showing any guide images or navigation.
    history.replaceState(null, '', location.pathname + location.search);
    async function enter() {
      if (key) {
        try {
          await readResponse(
            await apiFetch('/api/edit-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key }),
            }),
          );
        } catch (e) {
          setError((e as Error).message);
        }
      }
      const state = await readResponse<{
        active: boolean;
        passwordEnabled: boolean;
      }>(await apiFetch('/api/edit-session', { cache: 'no-store' }));
      setEnabled(state.passwordEnabled);
      setReady(state.active);
    }
    void enter()
      .catch((e) => setError(e.message))
      .finally(() => setChecking(false));
  }, []);
  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await readResponse(
        await apiFetch('/api/edit-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        }),
      );
      setPassword('');
      if (!new URLSearchParams(location.search).has('hero'))
        history.replaceState(null, '', '/edit?page=workspace');
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (ready) return <Notebook mode="edit" />;
  return (
    <main className="main-wrap">
      <section className="reference-card link-entry password-entry">
        <span className="password-emblem">
          <KeyRound size={28} />
        </span>
        <p className="eyebrow">守御手册 · 共建攻略</p>
        <h1>验证后编辑</h1>
        {checking ? (
          <p role="status">正在检查编辑权限…</p>
        ) : enabled ? (
          <form onSubmit={unlock}>
            <p>输入站点所有者分享的密码，即可继续编写攻略。</p>
            <label className="field">
              <span>编辑密码</span>
              <Input
                type="password"
                autoComplete="current-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
                required
                disabled={busy}
                aria-describedby={error ? 'edit-password-error' : undefined}
              />
            </label>
            <Button type="submit" disabled={busy || !password}>
              <KeyRound />
              {busy ? '验证中…' : '验证并进入工作台'}
              <ArrowRight />
            </Button>
            <p className="muted">
              验证最长保留 12 小时。所有者换密码后，旧权限立即失效。
            </p>
          </form>
        ) : (
          <p>
            尚未启用密码编辑，请联系站点所有者设置密码，或向其获取有效编辑链接。
          </p>
        )}
        {error && (
          <p id="edit-password-error" className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="entry-links">
          <a className="text-link" href="/">
            返回只读攻略
          </a>
          <a className="text-link" href="/manage?page=workspace" target="_top">
            <ShieldCheck size={16} />
            我是站点所有者
          </a>
        </div>
      </section>
    </main>
  );
}
