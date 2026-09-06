'use client';
import { useState, useEffect, type FormEvent } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, readResponse } from '@/lib/client-api';
export function OwnerEntry() {
  const [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    setChanged(
      new URLSearchParams(location.search).get('password') === 'changed',
    );
  }, []);
  async function enter(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await readResponse(
        await apiFetch('/api/owner-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        }),
      );
      setPassword('');
      location.replace('/manage?page=workspace');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="main-wrap">
      <section className="reference-card link-entry password-entry">
        <span className="password-emblem">
          <ShieldCheck size={28} />
        </span>
        <p className="eyebrow">守御手册 · 站长专属</p>
        <h1>站长工作台</h1>
        {changed && (
          <p className="notice" role="status">
            站长密码更新成功。请用新密码登录，再重新设置共享编辑权限。
          </p>
        )}
        <p>使用你独立保管的站长密码登录。共享编辑密码不能进入这里。</p>
        <form onSubmit={enter}>
          <label className="field">
            <span>站长密码</span>
            <Input
              type="password"
              name="owner-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={128}
              disabled={busy}
            />
          </label>
          <Button type="submit" disabled={busy || !password}>
            <ShieldCheck />
            {busy ? '验证中…' : '登录站长工作台'}
            <ArrowRight />
          </Button>
        </form>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <p className="muted">
          请勿把站长密码发给其他编辑者。忘记密码时，可通过你自己的部署账号重设。
        </p>
        <div className="entry-links">
          <a className="text-link" href="/">
            返回只读攻略
          </a>
          <a className="text-link" href="/edit?page=workspace">
            我是共同编辑者
          </a>
        </div>
      </section>
    </main>
  );
}
