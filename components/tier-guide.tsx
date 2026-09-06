'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { defaultTierSettings, type TierSettings } from '@/lib/tiers';
import { readResponse } from '@/lib/client-api';
export function TierBadge({ tier }: { tier?: string }) {
  return (
    <span
      className={`tier-badge tier-${(tier || 'unrated').replace('.', '-')}`}
    >
      {tier?.startsWith('T') ? (
        <>
          <span className="tier-letter">T</span>
          <span className="tier-number">{tier.slice(1)}</span>
        </>
      ) : (
        '未评级'
      )}
    </span>
  );
}
export function TierGuide({
  editable = false,
  tier,
}: {
  editable?: boolean;
  tier?: string;
}) {
  const [open, setOpen] = useState(false),
    [settings, setSettings] = useState<TierSettings>(defaultTierSettings),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function show() {
    setOpen(true);
    setEditing(false);
    setBusy(true);
    setError('');
    try {
      setSettings(await readResponse<TierSettings>(await fetch('/api/tiers')));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          expectedRevision: settings.revision,
        }),
      });
      setSettings(await readResponse<TierSettings>(r));
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant={tier ? 'ghost' : 'outline'}
        className={tier ? 'tier-badge-trigger touch' : 'touch'}
        aria-label={tier ? `查看${tier}评级标准` : '查看梯度标准'}
        onClick={() => void show()}
      >
        {tier ? <TierBadge tier={tier === '未评级' ? '' : tier} /> : '梯度标准'}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="talent-detail-editor" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>英雄强度 · 梯度标准</DialogTitle>
            <DialogDescription>
              攻略团队评级，非官方排名。英雄评级在“英雄资料”中修改；此处维护所有英雄共用的判断标准。
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy} className="detail-edit-fields">
            {!editing && tier && (
              <section className="current-tier-standard">
                <TierBadge tier={tier === '未评级' ? '' : tier} />
                <div>
                  <strong>当前评级标准</strong>
                  <p>
                    {settings.items.find((item) => item.tier === tier)
                      ?.description || '该英雄尚未评级，等待编辑成员确认。'}
                  </p>
                </div>
              </section>
            )}
            {editing ? (
              <label className="field" htmlFor="tier-conditions">
                <span>评判条件与适用版本</span>
                <Textarea
                  id="tier-conditions"
                  value={settings.context}
                  maxLength={2000}
                  onChange={(e) =>
                    setSettings({ ...settings, context: e.target.value })
                  }
                />
              </label>
            ) : (
              <p className="tier-context preserve">{settings.context}</p>
            )}
            {settings.items.map((item) => (
              <section className="tier-standard" key={item.tier}>
                <TierBadge tier={item.tier} />
                {editing ? (
                  <Textarea
                    aria-label={`${item.tier} 判断标准`}
                    value={item.description}
                    maxLength={1600}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        items: settings.items.map((i) =>
                          i.tier === item.tier
                            ? { ...i, description: e.target.value }
                            : i,
                        ),
                      })
                    }
                  />
                ) : (
                  <p>{item.description}</p>
                )}
              </section>
            ))}
            {error && (
              <p className="notice" role="alert">
                {error}
              </p>
            )}
          </fieldset>
          <DialogFooter>
            {editable &&
              (editing ? (
                <Button
                  className="touch"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  保存并公开标准
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="touch"
                  disabled={busy || !!error}
                  onClick={() => setEditing(true)}
                >
                  编辑标准
                </Button>
              ))}
            <Button
              variant="outline"
              className="touch"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {editing ? '取消修改' : '关闭'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
