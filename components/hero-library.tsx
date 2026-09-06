'use client';
import { useState } from 'react';
import {
  Search,
  ArrowUpRight,
  BookOpen,
  Clock3,
  CalendarDays,
  Layers3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { heroes, type GuideRecord } from '@/lib/guide';
import { rosterHeroIds, type ModeRoster } from '@/lib/mode-roster';
import { heroTiers } from '@/lib/tiers';
import { TierBadge, TierGuide } from './tier-guide';
import { guideFreshness } from '@/lib/guide-freshness';
import { RosterEditor } from './roster-editor';

export function HeroLibrary({
  roster,
  records,
  editable,
  loading,
  onRosterSaved,
  onOpen,
}: {
  roster: ModeRoster;
  records: GuideRecord[];
  editable: boolean;
  loading: boolean;
  onRosterSaved: (roster: ModeRoster) => void;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState(''),
    [role, setRole] = useState('全部'),
    [tier, setTier] = useState('全部'),
    [batch, setBatch] = useState('all'),
    [status, setStatus] = useState('all');
  const ids = rosterHeroIds(roster),
    published = records.filter((r) => ids.includes(r.heroId) && r.published);
  const activeBatch = roster.groups.some((g) => g.id === batch) ? batch : 'all';
  const groups = roster.groups
    .filter((g) => activeBatch === 'all' || g.id === activeBatch)
    .map((g) => ({
      ...g,
      entries: g.heroIds
        .map((id) => ({
          hero: heroes.find((h) => h.id === id)!,
          record: published.find((r) => r.heroId === id),
        }))
        .filter(({ hero, record }) => {
          const guide = record?.published;
          return (
            hero &&
            (role === '全部' || hero.roles.includes(role)) &&
            (tier === '全部' || (guide?.tier || '未评级') === tier) &&
            (status === 'all' || (status === 'ready' ? !!guide : !guide)) &&
            `${hero.name}${hero.pinyin}${guide?.title || ''}${guide?.builds.map((b) => b.name).join('') || ''}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())
          );
        }),
    }));
  const count = groups.reduce((n, g) => n + g.entries.length, 0);
  return (
    <>
      <section className="intro roster-intro">
        <div>
          <p className="eyebrow">无尽守御 · 英雄图鉴</p>
          <h1>
            找到你的英雄，<span>写下你的流派。</span>
          </h1>
          <p className="muted preserve">{roster.intro}</p>
        </div>
        <div className="roster-count">
          <strong>{ids.length}</strong>
          <span>
            模式英雄<small>{published.length} 位已有攻略 · 三批轮换</small>
          </span>
        </div>
      </section>
      <div className="roster-toolbar">
        <p>
          <CalendarDays size={16} /> 每周轮换一批 · 批次不代表强度
        </p>
        {editable && <RosterEditor roster={roster} onSaved={onRosterSaved} />}
      </div>
      <div className="batch-filters" aria-label="轮换批次">
        <Button
          variant="ghost"
          className={`batch-filter ${activeBatch === 'all' ? 'selected' : ''}`}
          aria-pressed={activeBatch === 'all'}
          onClick={() => setBatch('all')}
        >
          <Layers3 size={20} />
          <span>
            全部英雄<small>完整模式英雄池</small>
          </span>
          <b>{ids.length}</b>
        </Button>
        {roster.groups.map((g, i) => (
          <Button
            key={g.id}
            variant="ghost"
            className={`batch-filter ${activeBatch === g.id ? 'selected' : ''}`}
            aria-pressed={activeBatch === g.id}
            onClick={() => setBatch(g.id)}
          >
            <span className="batch-number">0{i + 1}</span>
            <span>
              {g.name}
              <small>每周轮换一批</small>
            </span>
            <b>{g.heroIds.length}</b>
          </Button>
        ))}
      </div>
      <div className="filter-bar">
        <div className="searchbox">
          <Search size={18} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模式英雄或已发布流派"
            aria-label="搜索模式英雄或流派"
          />
        </div>
        <div className="role-filters">
          {['全部', '战士', '法师', '坦克', '刺客', '射手', '辅助'].map((r) => (
            <Button
              key={r}
              variant="ghost"
              className={role === r ? 'selected' : ''}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>
      <div className="tier-filter-bar">
        <span>英雄强度</span>
        <div className="tier-filters">
          {['全部', ...heroTiers, '未评级'].map((v) => (
            <Button
              key={v}
              variant="ghost"
              className={`touch ${tier === v ? 'selected' : ''}`}
              aria-pressed={tier === v}
              onClick={() => setTier(v)}
            >
              {v}
            </Button>
          ))}
        </div>
        <TierGuide editable={editable} />
      </div>
      <div className="roster-status-filter">
        <div>
          {[
            ['all', '全部'],
            ['ready', `已有攻略 ${published.length}`],
            ['pending', `待补充 ${ids.length - published.length}`],
          ].map(([v, label]) => (
            <Button
              variant="ghost"
              key={v}
              className={`touch ${status === v ? 'selected' : ''}`}
              aria-pressed={status === v}
              onClick={() => setStatus(v)}
            >
              {label}
            </Button>
          ))}
        </div>
        <span>找到 {count} 位英雄</span>
      </div>
      {loading ? (
        <div className="mode-hero-grid">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : count ? (
        groups
          .filter((g) => g.entries.length)
          .map((g) => (
            <section className="roster-batch-section" key={g.id}>
              <header>
                <h2>{g.name}</h2>
                <span>{g.entries.length} 位英雄</span>
                <i />
              </header>
              <div className="mode-hero-grid">
                {g.entries.map(({ hero, record }) => (
                  <button
                    key={hero.id}
                    className={`mode-hero-card ${record ? 'has-guide' : 'is-pending'}`}
                    onClick={() => onOpen(hero.id)}
                    aria-label={`${hero.name}，${record ? '查看攻略' : '攻略待补充'}`}
                  >
                    <span className="mode-hero-portrait">
                      <img
                        src={hero.avatar}
                        alt=""
                        width={86}
                        height={86}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      {record && (
                        <span className="hero-guide-seal">
                          <BookOpen size={12} />
                        </span>
                      )}
                    </span>
                    <span className="mode-hero-name">
                      {hero.name}
                      {record?.published?.tier && (
                        <TierBadge tier={record.published.tier} />
                      )}
                    </span>
                    <span className="mode-hero-role">
                      {hero.roles.join(' / ')}
                    </span>
                    <span className="mode-hero-status">
                      {record ? (
                        <>
                          <BookOpen size={12} />
                          {record.published!.builds.length} 个流派
                          <ArrowUpRight size={13} />
                        </>
                      ) : (
                        <>
                          <Clock3 size={12} />
                          攻略待补充
                        </>
                      )}
                    </span>
                    {record && (
                      <span className="mode-hero-update">
                        <RosterGuideDate publishedAt={record.publishedAt} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))
      ) : (
        <div className="guide-empty roster-no-results">
          <h2>没有符合筛选的模式英雄</h2>
          <p>尚未编写攻略的英雄也可以从“全部”查看。</p>
          <Button
            variant="outline"
            className="touch"
            onClick={() => {
              setQuery('');
              setRole('全部');
              setTier('全部');
              setStatus('all');
              setBatch('all');
            }}
          >
            清除筛选
          </Button>
        </div>
      )}
    </>
  );
}

function RosterGuideDate({ publishedAt }: { publishedAt: string | null }) {
  const value = guideFreshness(publishedAt);
  if (!value) return null;
  return (
    <span
      className={`roster-guide-date ${value.stale ? 'is-stale' : ''}`}
      title={`攻略最近更新：${value.date} · ${value.label}`}
    >
      <time dateTime={publishedAt!}>{value.date}</time> 更新
      {value.stale && <small>留意版本变化</small>}
    </span>
  );
}
