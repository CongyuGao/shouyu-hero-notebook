'use client';
import { useEffect, useState } from 'react';
import { Copy, Link2, RefreshCw, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
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
type Status = { enabled: boolean; revision: number; expiresAt: string | null };
const durationLabels: Record<string, string> = {
  '1': '1 小时',
  '24': '1 天',
  '168': '7 天',
  '720': '30 天',
};
export function EditLinkPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [hours, setHours] = useState('168');
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'rotate' | 'revoke' | null>(null);
  async function load() {
    setStatus(
      await readResponse<Status>(
        await apiFetch('/api/edit-link', { cache: 'no-store' }),
      ),
    );
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, []);
  async function update(action: 'create' | 'rotate' | 'revoke') {
    if (!status || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await readResponse<Status & { key: string | null }>(
        await apiFetch('/api/edit-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            hours: Number(hours),
            expectedRevision: status.revision,
          }),
        }),
      );
      setStatus(result);
      setLink(result.key ? `${location.origin}/edit#key=${result.key}` : '');
      setMessage(
        action === 'revoke'
          ? '编辑链接已作废，持有旧链接的人不能再保存修改。'
          : '编辑链接已生成。请复制后私发给共同编辑的人。',
      );
    } catch (e) {
      setMessage((e as Error).message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label}已复制。`);
    } catch {
      setMessage('无法自动复制，请选中下方链接手动复制。');
    }
  }
  return (
    <section className="reference-card edit-link-panel">
      <h2>
        <Link2 size={22} /> 专属编辑链接
      </h2>
      <p>
        收到链接的人无需账号即可编辑核心、天赋、雕文、铭文和攻略。请勿发到公开群公告；转发链接会一并转交编辑能力。
      </p>
      <div className="link-settings">
        <label className="field">
          <span>新链接有效期</span>
          <Select
            value={hours}
            onValueChange={(v) => v && setHours(v)}
            disabled={busy}
          >
            <SelectTrigger>
              <SelectValue>{durationLabels[hours]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(durationLabels).map(([value, name]) => (
                <SelectItem key={value} value={value}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <p>
          {status?.enabled
            ? `有效至 ${new Date(status.expiresAt!).toLocaleString('zh-CN', { hour12: false })}`
            : '当前没有有效编辑链接'}
        </p>
      </div>
      <div className="button-row">
        <Button
          disabled={busy || !status}
          onClick={() =>
            status?.enabled ? setConfirm('rotate') : void update('create')
          }
        >
          <RefreshCw />
          {status?.enabled ? '重置编辑链接' : '生成编辑链接'}
        </Button>
        {status?.enabled && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConfirm('revoke')}
          >
            <ShieldOff />
            作废链接
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => void copy(`${location.origin}/`, '只读链接')}
        >
          复制普通只读链接
        </Button>
      </div>
      {link && (
        <div className="link-result">
          <label className="field">
            <span>仅本次显示，请妥善保存</span>
            <Input
              readOnly
              value={link}
              autoComplete="off"
              spellCheck={false}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <Button
            disabled={busy}
            onClick={() => void copy(link, '专属编辑链接')}
          >
            <Copy />
            复制编辑链接
          </Button>
        </div>
      )}
      <p className="muted">
        到期自动失效。忘记链接可以重置；重置后旧链接及已打开的旧编辑会话均不能继续保存。普通攻略的“分享”按钮只复制只读链接。
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && !busy && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirm === 'rotate' ? '重置编辑链接？' : '作废编辑链接？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            旧链接和已打开的旧编辑会话会失效。请先提醒共同编辑的人保存或导出正在修改的内容。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => confirm && void update(confirm)}
            >
              确认{confirm === 'rotate' ? '重置' : '作废'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
