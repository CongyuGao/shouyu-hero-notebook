'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readResponse } from '@/lib/client-api';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
export function MemberPanel() {
  const [editors, setEditors] = useState<Array<{ email: string }>>([]),
    [email, setEmail] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState('');
  async function load() {
    const r = await fetch('/api/editors');
    const j = await readResponse<Array<{ email: string }>>(r);
    setEditors(j);
  }
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  async function update(action: string, value: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/editors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, action }),
      });
      await readResponse<{ ok: boolean }>(r);
      await load();
      setMessage(
        action === 'add'
          ? '已授予编辑权限。请把网站链接发给对方，使用此邮箱对应的 ChatGPT 账号登录。'
          : '编辑权限已移除。',
      );
      setEmail('');
      setRemove('');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="member-panel reference-card">
      <h2>指定编辑成员</h2>
      <p>所有人都能阅读。只有你和下列成员可以保存或发布攻略。</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void update('add', email);
        }}
        className="member-form"
      >
        <label className="field">
          <span>成员的 ChatGPT 账号邮箱</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
          />
        </label>
        <Button className="touch" type="submit" disabled={busy}>
          添加成员
        </Button>
      </form>
      <p className="muted">此操作仅授予权限，不会发送邀请邮件。</p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="history-row">
        <span>你（管理员）</span>
        <span className="muted">始终拥有权限</span>
      </div>
      {editors.map((e) => (
        <div className="history-row" key={e.email}>
          <span>{e.email}</span>
          <Button
            variant="destructive"
            className="touch"
            disabled={busy}
            onClick={() => setRemove(e.email)}
          >
            移除
          </Button>
        </div>
      ))}
      <AlertDialog
        open={!!remove}
        onOpenChange={(open) => {
          if (!open) setRemove('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>移除编辑权限？</AlertDialogTitle>
          <AlertDialogDescription>
            {remove} 将不能再编辑，但仍可查看公开攻略。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => void update('remove', remove)}
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
