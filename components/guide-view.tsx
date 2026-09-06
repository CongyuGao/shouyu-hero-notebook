'use client';
import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Link2,
  Pencil,
  Target,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { heroes, priorities, type Guide, type GuideRecord } from '@/lib/guide';
export function GuideView({
  guide,
  record,
  onBack,
  onEdit,
}: {
  guide: Guide;
  record: GuideRecord;
  onBack: () => void;
  onEdit?: () => void;
}) {
  const hero = heroes.find((h) => h.id === guide.heroId)!;
  const [message, setMessage] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?hero=${guide.heroId}`,
      );
      setMessage('攻略链接已复制，可发送到 QQ / 微信');
    } catch {
      setMessage(
        `请复制地址栏链接分享：${location.origin}/?hero=${guide.heroId}`,
      );
    }
  }
  return (
    <article className="guide-reader">
      <div className="reader-actions">
        <Button variant="ghost" className="touch" onClick={onBack}>
          <ArrowLeft />
          全部英雄
        </Button>
        <div className="button-row">
          <Button variant="outline" className="touch" onClick={copy}>
            <Link2 />
            分享
          </Button>
          {onEdit && (
            <Button className="touch" onClick={onEdit}>
              <Pencil />
              编辑攻略
            </Button>
          )}
        </div>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <header className="guide-heading">
        <img
          src={hero.avatar}
          alt={hero.name}
          width={88}
          height={88}
          referrerPolicy="no-referrer"
        />
        <div>
          <p className="eyebrow">{hero.name} / 无尽守御</p>
          <h1>{guide.title || `${hero.name} · 天赋流派攻略`}</h1>
          <div className="guide-meta">
            <span>{guide.author || '尚未署名'}</span>
            <span>{guide.version || '版本待填写'}</span>
            <span>
              {guide.verified ? (
                <>
                  <CheckCircle2 size={14} />
                  作者已核验
                </>
              ) : (
                <>
                  <Clock3 size={14} />
                  待核验
                </>
              )}
            </span>
            <span>
              {record.publishedAt
                ? new Date(record.publishedAt).toLocaleDateString('zh-CN')
                : '草稿预览'}
            </span>
          </div>
        </div>
      </header>
      {guide.intro && <p className="guide-intro preserve">{guide.intro}</p>}
      <Tabs defaultValue={guide.builds[0].id} key={guide.heroId}>
        <div className="build-nav">
          <span className="eyebrow">核心流派</span>
          <TabsList className="build-tabs">
            {guide.builds.map((b) => (
              <TabsTrigger key={b.id} value={b.id}>
                {b.name || '未命名流派'}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {guide.builds.map((b) => (
          <TabsContent key={b.id} value={b.id}>
            <section className="build-summary">
              <span className="summary-icon">
                <Target />
              </span>
              <div>
                <h2>{b.name || '流派思路'}</h2>
                <p className="preserve">
                  {b.summary || '等待作者补充流派思路。'}
                </p>
              </div>
            </section>
            {b.order && (
              <section className="order-note">
                <h3>天赋选择顺序</h3>
                <p className="preserve">{b.order}</p>
              </section>
            )}
            <div className="section-caption">
              <span>
                18 个小天赋{' '}
                <b>{guide.talents.filter((t) => t.name).length}/18 已录入</b>
              </span>
              <span>推荐仅适用于当前流派</span>
            </div>
            <div className="talent-grid">
              {guide.talents.map((t, i) => {
                const pick = b.picks.find((p) => p.talentId === t.id);
                const rank = pick?.priority || 'none';
                return (
                  <section className={`talent-card rank-${rank}`} key={t.id}>
                    <div className="talent-top">
                      <span className="talent-number">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className={`rank-label ${rank}`}>
                        {priorities[rank]}
                      </span>
                    </div>
                    <h3>{t.name || '天赋待补充'}</h3>
                    {t.description && (
                      <p className="talent-effect preserve">{t.description}</p>
                    )}
                    {pick?.reason && (
                      <div className="talent-reason">
                        <span>选择理由</span>
                        <p className="preserve">{pick.reason}</p>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
            {(b.glyphs || b.runes || b.arcana) && (
              <section className="support-grid">
                {[
                  ['雕文搭配', b.glyphs],
                  ['铭文', b.runes],
                  ['秘法', b.arcana],
                ]
                  .filter(([, v]) => v)
                  .map(([label, v]) => (
                    <article className="reference-card" key={label}>
                      <h3>
                        <Layers size={17} />
                        {label}
                      </h3>
                      <p className="preserve">{v}</p>
                    </article>
                  ))}
              </section>
            )}
            {b.notes && (
              <section className="longform">
                <h2>
                  <Sparkles size={20} />
                  实战打法与取舍
                </h2>
                <p className="preserve">{b.notes}</p>
              </section>
            )}
          </TabsContent>
        ))}
      </Tabs>
      {!!guide.glyphs?.length && (
        <section className="glyph-library">
          <div className="section-caption">
            <h2>
              <Layers size={22} />
              雕文介绍
            </h2>
            <span>无尽守御专属雕文</span>
          </div>
          <div className="glyph-grid">
            {guide.glyphs.map((g, i) => (
              <article className="glyph-card" key={g.id}>
                <span className="glyph-icon">
                  <Layers size={23} />
                </span>
                <div>
                  <p className="eyebrow">
                    GLYPH {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3>{g.name}</h3>
                  <p className="preserve">{g.effect}</p>
                  {g.usage && (
                    <div className="glyph-usage">
                      <strong>适配与取舍</strong>
                      <p className="preserve">{g.usage}</p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {guide.source && (
        <section className="source-note">
          <h3>资料来源 / 核验记录</h3>
          <p className="preserve">{guide.source}</p>
        </section>
      )}
    </article>
  );
}
