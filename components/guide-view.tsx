'use client';
import { useEffect, useState } from 'react';
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
import { heroes, type Guide, type GuideRecord } from '@/lib/guide';
import { SkillBoard } from './skill-board';
import { LoadoutPicker } from './loadout-picker';
import { TierGuide } from './tier-guide';
import { GuideUpdated } from './guide-updated';
export function GuideView({
  guide,
  record,
  onBack,
  onEdit,
  signInHref,
  onNewBuild,
  syncLocation = true,
}: {
  guide: Guide;
  record: GuideRecord;
  onBack: () => void;
  onEdit?: (skill?: number, buildId?: string) => void;
  signInHref?: string;
  onNewBuild?: () => void;
  syncLocation?: boolean;
}) {
  const hero = heroes.find((h) => h.id === guide.heroId)!;
  const [message, setMessage] = useState('');
  const [buildId, setBuildId] = useState(guide.builds[0].id);
  useEffect(() => {
    if (!syncLocation) return;
    const read = () => {
      const id = new URL(location.href).searchParams.get('build');
      setBuildId(
        guide.builds.find((b) => b.id === id)?.id || guide.builds[0].id,
      );
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [guide.builds, syncLocation]);
  function selectBuild(id: string) {
    setBuildId(id);
    if (syncLocation) {
      const url = new URL(location.href);
      url.searchParams.set('hero', guide.heroId);
      url.searchParams.set('build', id);
      history.pushState(null, '', url.pathname + url.search);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?hero=${guide.heroId}&build=${encodeURIComponent(buildId)}`,
      );
      setMessage('攻略链接已复制，可发送到 QQ / 微信');
    } catch {
      setMessage(
        `请复制链接分享：${location.origin}/?hero=${guide.heroId}&build=${encodeURIComponent(buildId)}`,
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
            <Button className="touch" onClick={() => onEdit()}>
              <Pencil />
              编辑 / 选择天赋
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
          </div>
          <GuideUpdated publishedAt={record.publishedAt} />
        </div>
      </header>
      {guide.intro && <p className="guide-intro preserve">{guide.intro}</p>}
      <section className="hero-tier-panel">
        <TierGuide tier={guide.tier || '未评级'} editable={!!onEdit} />
        <div>
          <strong>英雄强度 · 团队评级</strong>
          <p>{guide.tierReason || '具体评级理由与适用条件待编辑补充。'}</p>
          <small>点击左侧评级，查看对应标准</small>
        </div>
        <TierGuide editable={!!onEdit} />
      </section>
      {signInHref && (
        <div className="reader-edit-entry">
          <div>
            <Pencil size={19} />
            <p>
              <strong>你们的攻略，可以持续调整。</strong>
              <span>编辑成员登录后，可改天赋描述、勾选天赋和搭配雕文。</span>
            </p>
          </div>
          <a className="auth-link" target="_top" href={signInHref}>
            登录并编辑
          </a>
        </div>
      )}
      <Tabs
        value={
          guide.builds.some((b) => b.id === buildId)
            ? buildId
            : guide.builds[0].id
        }
        onValueChange={(v) => selectBuild(String(v))}
        key={guide.heroId}
      >
        <div className="build-nav">
          <div className="build-nav-heading">
            <div>
              <span className="eyebrow">流派攻略</span>
              <p>选择一个流派，查看它独立的天赋与雕文、铭文配置。</p>
            </div>
            {onNewBuild && (
              <Button className="touch" variant="outline" onClick={onNewBuild}>
                ＋ 新写一个流派
              </Button>
            )}
          </div>
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
            <SkillBoard
              guide={guide}
              build={b}
              onEdit={onEdit ? (skill) => onEdit(skill, b.id) : undefined}
            />
            <LoadoutPicker
              guide={guide}
              build={b}
              onEdit={onEdit ? () => onEdit(1, b.id) : undefined}
            />
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
            {(b.notes || onEdit) && (
              <section className="longform">
                <h2>
                  <Sparkles size={20} />
                  {b.name} · 打法详解与备注
                </h2>
                <p className="preserve">
                  {b.notes ||
                    '这里可以补充该流派的详细解释、操作技巧与注意事项。'}
                </p>
                {onEdit && (
                  <Button
                    className="touch"
                    variant="outline"
                    onClick={() => onEdit(1, b.id)}
                  >
                    编辑本流派备注
                  </Button>
                )}
              </section>
            )}
          </TabsContent>
        ))}
      </Tabs>
      {(guide.notes || onEdit) && (
        <section className="longform hero-notes">
          <h2>
            <Sparkles size={20} />
            英雄攻略 · 通用说明
          </h2>
          <p className="preserve">
            {guide.notes ||
              '这里可以写所有流派共用的英雄机制、玩法解释与注意事项。'}
          </p>
          {onEdit && (
            <Button
              className="touch"
              variant="outline"
              onClick={() => onEdit(0)}
            >
              编辑英雄资料与备注
            </Button>
          )}
        </section>
      )}
      {guide.source && (
        <details className="source-note">
          <summary>来源与核验记录</summary>
          <p className="preserve">{guide.source}</p>
        </details>
      )}
    </article>
  );
}
