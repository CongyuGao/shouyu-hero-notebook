'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Download, Image as ImageIcon, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { GuideRecord } from '@/lib/guide';
import { createGuideExport } from '@/lib/guide-export';
import type { ExportedImage } from '@/lib/guide-export-canvas';

type PreviewImage = ExportedImage & { url: string };

export function GuideExportDialog({
  record,
  buildId,
}: {
  record: GuideRecord;
  buildId: string;
}) {
  const [open, setOpen] = useState(false);
  const effectsId = useId();
  const [effects, setEffects] = useState(false);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const run = useRef(0);
  useEffect(
    () => () => {
      images.forEach((image) => URL.revokeObjectURL(image.url));
    },
    [images],
  );
  useEffect(
    () => () => {
      run.current++;
      controller.current?.abort();
    },
    [],
  );
  const build = record.published?.builds.find((item) => item.id === buildId);
  if (!record.published || !record.publishedAt || !build) return null;

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      run.current++;
      controller.current?.abort();
      setBusy(false);
      setImages([]);
      setMessage('');
      setError('');
    }
  }
  async function generate() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const thisRun = ++run.current;
    setBusy(true);
    setError('');
    setMessage('');
    setImages([]);
    try {
      const snapshot = createGuideExport(
        record,
        buildId,
        location.origin,
        effects,
      );
      const { renderGuideExport } = await import('@/lib/guide-export-canvas');
      const result = await renderGuideExport(snapshot, abort.signal);
      if (thisRun !== run.current || abort.signal.aborted) return;
      setImages(
        result.images.map((image) => ({
          ...image,
          url: URL.createObjectURL(image.blob),
        })),
      );
      setMessage(
        result.missingImages
          ? `已生成 ${result.images.length} 张图。有 ${result.missingImages} 个图片资源未加载，已保留名称和所有加点信息；可重试生成。`
          : `已生成 ${result.images.length} 张高清攻略图，向下滚动可连续预览全部图片。`,
      );
    } catch (e) {
      if (thisRun === run.current && !abort.signal.aborted)
        setError((e as Error).message || '生成失败，请重试。');
    } finally {
      if (thisRun === run.current) setBusy(false);
    }
  }
  async function share(current: PreviewImage) {
    try {
      const file = new File([current.blob], current.name, {
        type: 'image/png',
      });
      if (!navigator.canShare?.({ files: [file] }) || !navigator.share) {
        setMessage(
          '当前浏览器不支持图片分享，请点“保存这张 PNG”，或在手机上长按图片保存。',
        );
        return;
      }
      await navigator.share({
        files: [file],
        title: build?.name || '守御手册攻略',
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError')
        setError('系统分享未完成，请直接保存图片后上传。');
    }
  }
  return (
    <>
      <Button
        variant="outline"
        className="touch guide-image-export-button"
        onClick={() => changeOpen(true)}
      >
        <ImageIcon /> 导出攻略图
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="guide-image-export-dialog scrollable-site-dialog">
          <DialogHeader>
            <DialogTitle>高清攻略图 · {build.name || '当前流派'}</DialogTitle>
            <DialogDescription>
              自动汇总全部技能、雕文与铭文，不用切换技能截图。只导出已发布内容，不包含草稿或编辑权限。
            </DialogDescription>
          </DialogHeader>
          <div className="guide-export-controls">
            <label className="guide-export-option" htmlFor={effectsId}>
              <Checkbox
                id={effectsId}
                checked={effects}
                disabled={busy}
                onCheckedChange={(checked) => {
                  setEffects(checked);
                  setImages([]);
                  setMessage('');
                }}
              />
              <span>
                附效果说明与打法备注
                <small>
                  默认导出整套加点长图，每组 8
                  个小天赋紧凑排列；勾选后附带图标的雕文详解与完整效果，所有图片连续预览。
                </small>
              </span>
            </label>
            <Button
              className="touch"
              disabled={busy}
              onClick={() => void generate()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ImageIcon />}
              {busy ? '正在排版…' : images.length ? '重新生成' : '生成高清图片'}
            </Button>
          </div>
          {error && (
            <p className="notice guide-export-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <output className="guide-export-status" aria-live="polite">
              {message}
            </output>
          )}
          {images.length ? (
            <>
              <div className="guide-export-pages" aria-label="全部攻略图片预览">
                {images.map((current, index) => (
                  <article className="guide-export-page" key={current.name}>
                    <div className="guide-export-page-heading">
                      <strong>
                        第 {index + 1} 张 · {current.title}
                      </strong>
                      <small>
                        {current.width} × {current.height} · PNG
                      </small>
                    </div>
                    <div className="guide-export-save">
                      <Button
                        render={
                          <a
                            href={current.url}
                            download={current.name}
                            aria-label={`保存第 ${index + 1} 张 PNG`}
                          />
                        }
                        className="touch"
                      >
                        <Download />
                        保存这张 PNG
                      </Button>
                      <Button
                        variant="outline"
                        className="touch"
                        onClick={() => void share(current)}
                      >
                        <Share2 />
                        系统分享这张
                      </Button>
                    </div>
                    <div className="guide-export-preview">
                      {/* Blob URLs are generated locally and cannot use a server image optimizer. */}
                      {/* eslint-disable-next-line next/no-img-element */}
                      <img
                        src={current.url}
                        alt={`${build.name || '当前流派'}攻略图，第${index + 1}张，共${images.length}张`}
                        width={current.width}
                        height={current.height}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    </div>
                  </article>
                ))}
              </div>
              <p className="guide-export-help">
                手机也可以长按预览图保存，再上传到 QQ
                群相册。若上传时有“原图”选项，请开启。图片不会随着攻略更新而自动变化，更新后需重新导出。
              </p>
            </>
          ) : (
            <div className="guide-export-empty" aria-live="polite">
              <ImageIcon size={36} />
              <strong>
                {busy ? '正在汇总整套加点长图' : '一键汇总，不用切技能截图'}
              </strong>
              <p>
                1080 像素宽 · 亮色勾选 · 大字排版
                <br />
                保留英雄、流派、更新日期与公开攻略地址
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
