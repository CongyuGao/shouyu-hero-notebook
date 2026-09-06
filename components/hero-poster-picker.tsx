'use client';
import { useState } from 'react';
import { Check, Images, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { findHeroSkin, heroSkins, skinImageUrl } from '@/lib/skins';

export function HeroPosterPicker({
  heroId,
  value,
  disabled,
  onChange,
}: {
  heroId: string;
  value?: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(value || '');
  const [query, setQuery] = useState('');
  const items = heroSkins.filter((skin) => skin.heroId === heroId);
  const current = findHeroSkin(value, heroId);
  const chosen = findHeroSkin(pending, heroId);
  const filtered = items.filter((skin) =>
    `${skin.name} ${skin.labels.join(' ')}`.includes(query.trim()),
  );
  return (
    <section className="hero-poster-setting">
      <div>
        <strong>英雄皮肤海报</strong>
        <p>
          {current ? `当前：${current.name}` : '未选择海报，保留现有头像与背景'}
        </p>
      </div>
      <Button
        variant="outline"
        className="touch"
        disabled={disabled || !heroId}
        onClick={() => {
          setPending(value || '');
          setQuery('');
          setOpen(true);
        }}
      >
        <Images size={18} />
        选择皮肤海报
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="skin-picker-dialog scrollable-site-dialog">
          <DialogHeader>
            <DialogTitle>
              {items[0]?.heroName || '英雄'} · 皮肤海报库
            </DialogTitle>
            <DialogDescription>
              由你选择封面，保存或发布攻略后生效。所选海报同时用于英雄页和攻略导出，不改变任何加点。
            </DialogDescription>
          </DialogHeader>
          {chosen && (
            <div className="skin-picker-preview">
              {/* eslint-disable-next-line next/no-img-element */}
              <img
                src={skinImageUrl(chosen.id)}
                alt={`${chosen.heroName} · ${chosen.name}海报预览`}
              />
              <span>{chosen.name}</span>
            </div>
          )}
          <Input
            aria-label="搜索皮肤名称或标签"
            placeholder="搜索皮肤名称、传说、史诗…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="skin-picker-grid">
            {filtered.map((skin) => (
              <button
                type="button"
                key={skin.id}
                className="skin-picker-card"
                aria-pressed={pending === skin.id}
                onClick={() => setPending(skin.id)}
              >
                {/* eslint-disable-next-line next/no-img-element */}
                <img
                  src={skinImageUrl(skin.id, 'thumbnail')}
                  alt={`${skin.heroName} · ${skin.name}`}
                  loading="lazy"
                />
                <span className="skin-card-name">
                  {skin.name}
                  {pending === skin.id && <Check size={18} />}
                </span>
                <span className="skin-card-labels">
                  {skin.labels.join(' · ') || '原版皮肤'}
                </span>
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="muted">
              {items.length
                ? '没有匹配的皮肤。'
                : '当前资料库暂未收录这个英雄的海报，先保留原有头像。'}
            </p>
          )}
          <p className="skin-library-note">
            皮肤标签沿用收录资料，不代表完整或实时的品质排名。游戏美术归原权利人所有。
          </p>
          <div className="skin-upload-note">
            <Button variant="ghost" disabled>
              <Upload size={16} />
              上传自定义海报
            </Button>
            <small>尚需站长授权图片存储，当前未启用上传。</small>
          </div>
          <div className="skin-picker-actions">
            <span>{chosen ? `已选：${chosen.name}` : '未选择海报'}</span>
            <Button
              variant="outline"
              className="touch"
              disabled={disabled}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              不使用海报
            </Button>
            <Button
              className="touch"
              disabled={disabled || !chosen}
              onClick={() => {
                onChange(pending);
                setOpen(false);
              }}
            >
              使用这张海报
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
