'use client';
import { useEffect, useState } from 'react';
import {
  Copy,
  Link2,
  RefreshCw,
  ShieldOff,
  Eye,
  Pencil,
  LockKeyhole,
} from 'lucide-react';
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
import { EditPasswordPanel } from './edit-password-panel';
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
  const [readLink, setReadLink] = useState('');
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
    setReadLink(`${location.origin}/`);
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
    <section id="sharing-settings" className="reference-card edit-link-panel">
      <h2>
        <Link2 size={22} /> 分享与编辑权限
      </h2>
      <p>
        普通链接始终只读。共同编辑可使用密码验证，或持有效的特殊编辑链接进入。
      </p>
      {readLink.startsWith('http://localhost:') && (
        <p className="notice">
          <LockKeyhole size={16} />{' '}
          当前是本地预览：这两种链接都只能在本机使用。网站上线后，请在公网管理页面重新生成分享链接。
        </p>
      )}
      <EditPasswordPanel
        onChanged={() => {
          setLink('');
          void load().catch((e) => setMessage(e.message));
        }}
      />
      <div className="share-permission-grid">
        <section
          className="share-permission-card read-permission"
          aria-label="只读分享"
        >
          <h3>
            <Eye size={20} /> 只读链接
          </h3>
          <p>适合发到 QQ 群或公告。打开的人只能查看已发布的攻略。</p>
          <label className="field">
            <span>普通查看地址</span>
            <Input
              value={readLink}
              readOnly
              aria-label="只读分享链接"
              onFocus={(e) => e.target.select()}
            />
          </label>
          <Button
            variant="outline"
            disabled={!readLink}
            onClick={() => void copy(readLink, '只读链接')}
          >
            <Copy /> 复制只读链接
          </Button>
        </section>
        <section
          className="share-permission-card edit-permission"
          aria-label="编辑分享"
        >
          <h3>
            <Pencil size={20} /> 可编辑链接
          </h3>
          <p>
            私发给共同编写攻略的人，无需账号。拿到或被转发此链接的人都能编辑。
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
        </section>
      </div>
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
