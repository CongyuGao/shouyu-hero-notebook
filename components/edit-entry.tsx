'use client';
import { useEffect, useRef, useState } from 'react';
import Notebook from '@/app/notebook';
import { apiFetch, readResponse } from '@/lib/client-api';
export function EditEntry() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = new URLSearchParams(location.hash.slice(1)).get('key');
    // Remove the capability before showing any guide images or navigation.
    history.replaceState(null, '', location.pathname + location.search);
    async function enter() {
      if (key)
        await readResponse(
          await apiFetch('/api/edit-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key }),
          }),
        );
      const state = await readResponse<{ active: boolean }>(
        await apiFetch('/api/edit-session', { cache: 'no-store' }),
      );
      if (!state.active)
        throw new Error(
          '请使用完整的专属编辑链接。链接可能已过期或被所有者作废。',
        );
      setReady(true);
    }
    void enter().catch((e) => setError(e.message));
  }, []);
  if (ready) return <Notebook mode="edit" />;
  return (
    <main className="main-wrap">
      <section className="reference-card link-entry">
        <h1>{error ? '暂时无法进入编辑' : '正在打开编辑工作台'}</h1>
        <p role={error ? 'alert' : 'status'}>
          {error || '正在验证链接有效期…'}
        </p>
        <a className="text-link" href="/">
          返回只读攻略
        </a>
      </section>
    </main>
  );
}
