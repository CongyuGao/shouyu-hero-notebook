'use client';
import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, readResponse } from '@/lib/client-api';
export function OwnerPasswordPanel() {
  const [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [repeat, setRepeat] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (password !== repeat) return setError('两次新密码不一致');
    if (password.trim().length < 20)
      return setError('站长密码至少 20 个字符，建议使用随机密码');
    setBusy(true);
    try {
      await readResponse(
        await apiFetch('/api/owner-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: current, password }),
        }),
      );
      setCurrent('');
      setPassword('');
      setRepeat('');
      location.replace('/manage?password=changed');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="reference-card owner-password-panel">
      <h2>
        <ShieldCheck size={22} /> 站长密码 · 仅自己保管
      </h2>
      <p>
        此密码用于管理权限，不用于分享。更改后，所有设备的站长登录失效，共享编辑密码会关闭、特殊链接会作废。请重新登录后设置新的编辑密码。
      </p>
      <form onSubmit={save}>
        <div className="password-fields">
          <label className="field">
            <span>当前站长密码</span>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              maxLength={128}
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>新站长密码</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={20}
              maxLength={128}
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>再次输入新密码</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              required
              minLength={20}
              maxLength={128}
              disabled={busy}
            />
          </label>
        </div>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? '正在更新…' : '更新站长密码并重新登录'}
        </Button>
      </form>
    </section>
  );
}
