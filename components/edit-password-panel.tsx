'use client';
import { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { apiFetch, readResponse } from '@/lib/client-api';
type Status = { enabled: boolean; revision: number; updatedAt: string | null };
export function EditPasswordPanel({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'set' | 'disable' | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const load = useCallback(
    async () =>
      setStatus(
        await readResponse<Status>(
          await apiFetch('/api/edit-password', { cache: 'no-store' }),
        ),
      ),
    [],
  );
  useEffect(() => {
    setEditUrl(`${location.origin}/edit?page=workspace`);
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function update(action: 'set' | 'disable') {
    if (busy || !status) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await readResponse<Status>(
        await apiFetch('/api/edit-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            password: action === 'set' ? password : undefined,
            expectedRevision: status.revision,
          }),
        }),
      );
      setStatus(result);
      setPassword('');
      setRepeat('');
      setMessage(
        action === 'set'
          ? '密码已保存。其他人的旧编辑权限和旧编辑链接均已失效；你的管理权限不受影响。'
          : '密码编辑已关闭，其他人的编辑权限及旧编辑链接均已失效。',
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  return (
    <section className="share-permission-card password-permission">
      <div className="password-panel-heading">
        <h3>
          <KeyRound size={20} />
          编辑密码
        </h3>
        <span>
          <ShieldCheck size={15} />
          仅你可更改
        </span>
      </div>
      <p>
        其他人知道密码也不能修改密码、生成链接或管理权限。你更改密码后，他们必须重新验证。
      </p>
      <p className="password-status">
        {status
          ? status.enabled
            ? '密码编辑已开启'
            : '尚未设置密码'
          : '正在读取设置…'}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          if (password !== repeat) {
            setError('两次输入的密码不一致');
            return;
          }
          if (password.trim().length < 12) {
            setError('请设置至少 12 个字符的密码');
            return;
          }
          setConfirm('set');
        }}
      >
        <div className="password-fields">
          <label className="field">
            <span>{status?.enabled ? '新密码' : '设置密码'}</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              maxLength={128}
              required
              disabled={busy}
              placeholder="至少 12 个字符"
            />
          </label>
          <label className="field">
            <span>再次输入密码</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              minLength={12}
              maxLength={128}
              required
              disabled={busy}
            />
          </label>
        </div>
        <div className="button-row">
          <Button
            type="submit"
            disabled={busy || !status || !password || !repeat}
          >
            <KeyRound />
            {busy
              ? '正在保存…'
              : status?.enabled
                ? '修改密码并收回旧权限'
                : '保存编辑密码'}
          </Button>
          {status?.enabled && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm('disable')}
            >
              关闭密码编辑
            </Button>
          )}
        </div>
      </form>
      <div className="password-share-link">
        <label className="field">
          <span>密码验证入口 · 此链接不包含密码</span>
          <Input value={editUrl} readOnly onFocus={(e) => e.target.select()} />
        </label>
        <Button
          variant="outline"
          disabled={!editUrl}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(editUrl);
              setMessage('密码编辑入口已复制，请另外私发密码给共同编辑的人。');
            } catch {
              setError('无法自动复制，请选中链接手动复制。');
            }
          }}
        >
          <Copy />
          复制编辑入口
        </Button>
      </div>
      <p className="muted">
        建议使用 20 位以上随机长密码，不要使用 QQ
        号或生日。忘记密码可直接在这里设新密码。请勿共用你的所有者账号。
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && !busy && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirm === 'set'
              ? '保存密码并收回旧编辑权限？'
              : '关闭密码编辑？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            其他人已验证的编辑权限、旧密码和旧特殊链接将失效，尚未保存的修改将无法提交。你的所有者管理权限不受影响。请先提醒共同编辑的人保存内容。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => confirm && void update(confirm)}
            >
              确认{confirm === 'set' ? '保存' : '关闭'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
