'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Shield,
  LockKeyhole,
  BookOpen,
  ArrowRight,
  Swords,
  Search,
  Plus,
  Pencil,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { heroes, type Access, type GuideRecord } from '@/lib/guide';
import { GuideView } from '@/components/guide-view';
import { GuideEditor } from '@/components/guide-editor';
import { MemberPanel } from '@/components/member-panel';
import { TierBadge, TierGuide } from '@/components/tier-guide';
import { GuidePrimer } from '@/components/guide-primer';
import { GuideUpdated } from '@/components/guide-updated';
import { heroTiers } from '@/lib/tiers';
import { registerNotebookTools } from '@/lib/webmcp';
import { readResponse } from '@/lib/client-api';
const anonymous: Access = {
  signedIn: false,
  canEdit: false,
  isAdmin: false,
  displayName: '',
};
export default function Notebook() {
  const [records, setRecords] = useState<GuideRecord[]>([]),
    [access, setAccess] = useState(anonymous),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tab, setTab] = useState('overview'),
    [query, setQuery] = useState(''),
    [role, setRole] = useState('全部'),
    [tier, setTier] = useState('全部'),
    [selected, setSelected] = useState(''),
    [editor, setEditor] = useState<{
      record: GuideRecord | null;
      key: number;
      initialSkill?: number;
      initialBuildId?: string;
      newBuild?: boolean;
    } | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/guides', { cache: 'no-store' }),
        j = await readResponse<{ guides: GuideRecord[]; access: Access }>(r);
      setRecords(j.guides);
      setAccess(j.access);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const read = () => {
      const params = new URL(location.href).searchParams;
      const heroId = params.get('hero') || '';
      setSelected(heroId);
      if (heroId) setTab('guides');
      else
        setTab(
          ['guides', 'workspace', 'about'].includes(params.get('page') || '')
            ? params.get('page')!
            : 'overview',
        );
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [refresh]);
  function openGuide(id: string) {
    setSelected(id);
    setTab('guides');
    history.pushState(
      null,
      '',
      id ? `/?hero=${encodeURIComponent(id)}` : '/?page=guides',
    );
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function start(
    record: GuideRecord | null = null,
    initialSkill = 1,
    initialBuildId?: string,
  ) {
    setEditor({ record, key: Date.now(), initialSkill, initialBuildId });
  }
  useEffect(() => {
    if (!access.canEdit || loading) return;
    const url = new URL(location.href);
    if (url.searchParams.get('edit') !== '1') return;
    const target = records.find(
      (r) => r.heroId === url.searchParams.get('hero'),
    );
    if (target) setEditor({ record: target, key: Date.now(), initialSkill: 1 });
    url.searchParams.delete('edit');
    history.replaceState(null, '', url.pathname + url.search);
  }, [access.canEdit, loading, records]);
  const state = useRef({ records, access, openGuide, start });
  state.current = { records, access, openGuide, start };
  useEffect(() => registerNotebookTools(() => state.current), []);
  const published = records.filter((r) => r.published),
    visible = published.filter((r) => {
      const h = heroes.find((h) => h.id === r.heroId)!;
      return (
        (role === '全部' || h.roles.includes(role)) &&
        (tier === '全部' || (r.published!.tier || '未评级') === tier) &&
        (!query ||
          `${h.name}${h.pinyin}${r.published!.title}${r.published!.builds.map((b) => b.name).join('')}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()))
      );
    });
  const active = records.find((r) => r.heroId === selected);
  const activeGuide = active?.published;
  const totalBuilds = published.reduce(
    (n, r) => n + r.published!.builds.length,
    0,
  );
  return (
    <div className="notebook">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Shield size={22} />
          </span>
          <strong>守御手册</strong>
          <span className="brand-sub">无尽守御</span>
        </a>
        {access.canEdit ? (
          <Button
            className="touch"
            variant="outline"
            onClick={() => {
              setTab('workspace');
              setSelected('');
            }}
          >
            <Pencil />
            编写攻略
          </Button>
        ) : access.signedIn ? (
          <Button
            className="touch"
            variant="outline"
            onClick={() => setTab('about')}
          >
            <LockKeyhole />
            账号权限
          </Button>
        ) : (
          <a
            className="auth-link"
            target="_top"
            href={
              '/signin-with-chatgpt?return_to=' +
              encodeURIComponent(selected ? `/?hero=${selected}&edit=1` : '/')
            }
          >
            <LockKeyhole size={16} />
            编辑成员登录
          </a>
        )}
      </header>
      <main className="main-wrap">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            const page = String(v);
            setTab(page);
            setSelected('');
            history.pushState(
              null,
              '',
              page === 'overview' ? '/' : `/?page=${encodeURIComponent(page)}`,
            );
          }}
        >
          <div className="nav-row">
            <TabsList variant="line" className="main-tabs">
              <TabsTrigger value="overview">
                <BookOpen />
                阅读前瞻
              </TabsTrigger>
              <TabsTrigger value="guides">
                <Swords />
                英雄攻略
              </TabsTrigger>
              {access.canEdit && (
                <TabsTrigger value="workspace">
                  <Pencil />
                  工作台
                </TabsTrigger>
              )}
              <TabsTrigger value="about">
                <BookOpen />
                共建说明
              </TabsTrigger>
            </TabsList>
            <span className="live-note">
              <i />
              公开查阅 · 指定成员编辑
            </span>
          </div>
          {error && (
            <div className="notice" role="alert">
              {error}
              <Button
                variant="ghost"
                className="touch"
                onClick={() => void refresh()}
              >
                <RefreshCw />
                重试
              </Button>
            </div>
          )}
          <TabsContent value="overview">
            <GuidePrimer editable={access.canEdit} />
            <div className="primer-next">
              <div>
                <h2>开始查阅英雄攻略</h2>
                <p>按英雄或梯度找到攻略，再选择具体流派。</p>
              </div>
              <Button className="touch" onClick={() => openGuide('')}>
                进入英雄攻略 <ArrowRight size={17} />
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="guides">
            {activeGuide && active ? (
              <GuideView
                key={active.heroId}
                guide={activeGuide}
                record={active}
                onBack={() => openGuide('')}
                onEdit={
                  access.canEdit
                    ? (skill, buildId) => start(active, skill, buildId)
                    : undefined
                }
                signInHref={
                  !access.signedIn
                    ? '/signin-with-chatgpt?return_to=' +
                      encodeURIComponent(`/?hero=${active.heroId}&edit=1`)
                    : undefined
                }
                onNewBuild={
                  access.canEdit &&
                  (active.draft || active.published)!.builds.length < 8
                    ? () =>
                        setEditor({
                          record: active,
                          key: Date.now(),
                          newBuild: true,
                        })
                    : undefined
                }
              />
            ) : (
              <>
                <section className="intro">
                  <div>
                    <p className="eyebrow">无尽守御 · 天赋手册</p>
                    <h1>
                      选对天赋，<span>打出你的流派。</span>
                    </h1>
                    <p className="muted">
                      从核心到小天赋，再到雕文搭配，讲清选择与理由。
                    </p>
                  </div>
                  <div className="intro-index">
                    <strong>{String(published.length).padStart(2, '0')}</strong>
                    <span>
                      已收录英雄
                      <br />
                      {totalBuilds} 个流派
                    </span>
                  </div>
                </section>
                {selected && !loading && (
                  <div className="notice">
                    这篇攻略尚未发布或已撤下。
                    <Button
                      variant="ghost"
                      className="touch"
                      onClick={() => openGuide('')}
                    >
                      返回全部攻略
                    </Button>
                  </div>
                )}
                {published.length > 0 && (
                  <div className="filter-bar">
                    <div className="searchbox">
                      <Search size={18} />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索英雄或流派"
                        aria-label="搜索英雄或流派"
                      />
                    </div>
                    <div className="role-filters">
                      {[
                        '全部',
                        '战士',
                        '法师',
                        '坦克',
                        '刺客',
                        '射手',
                        '辅助',
                      ].map((r) => (
                        <Button
                          key={r}
                          variant="ghost"
                          className={role === r ? 'selected' : ''}
                          onClick={() => setRole(r)}
                        >
                          {r}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="tier-filter-bar">
                  <span>英雄强度</span>
                  <div className="tier-filters">
                    {['全部', ...heroTiers, '未评级'].map((value) => (
                      <Button
                        key={value}
                        variant="ghost"
                        className={`touch ${tier === value ? 'selected' : ''}`}
                        aria-pressed={tier === value}
                        onClick={() => setTier(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                  <TierGuide editable={access.canEdit} />
                </div>
                <div className="section-caption">
                  <span>
                    无尽守御 · 英雄攻略 <b>{visible.length || ''}</b>
                  </span>
                  <span>只收录已确认的模式英雄</span>
                </div>
                {loading ? (
                  <div className="hero-grid">
                    {[1, 2, 3, 4].map((n) => (
                      <Skeleton key={n} className="h-40 rounded-xl" />
                    ))}
                  </div>
                ) : visible.length ? (
                  <div className="guide-card-grid">
                    {visible.map((r) => {
                      const h = heroes.find((h) => h.id === r.heroId)!,
                        d = r.published!;
                      return (
                        <button
                          key={r.heroId}
                          className="published-card"
                          onClick={() => openGuide(r.heroId)}
                        >
                          <div className="published-top">
                            <img
                              src={h.avatar}
                              alt=""
                              width={64}
                              height={64}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <h2>
                                {h.name} <TierBadge tier={d.tier} />
                              </h2>
                              <p>{h.roles.join(' / ')}</p>
                            </div>
                            <ChevronRight size={18} />
                          </div>
                          <h3>{d.title}</h3>
                          <div className="build-chips">
                            {d.builds.map((b) => (
                              <span key={b.id}>{b.name}</span>
                            ))}
                          </div>
                          <div className="published-meta">
                            <span>
                              {d.verified ? '作者已核验' : '待核验'} ·{' '}
                              {d.cores?.filter((c) => c.name).length || 0} 核心
                              · {d.talents.filter((t) => t.name).length} 天赋
                            </span>
                            <span>{d.author}</span>
                          </div>
                          <GuideUpdated compact publishedAt={r.publishedAt} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Empty className="guide-empty">
                    <EmptyHeader>
                      <span className="empty-emblem">
                        <BookOpen size={30} />
                      </span>
                      <EmptyTitle>
                        {published.length
                          ? '没有找到相关攻略'
                          : '第一篇攻略，留给你的拿手英雄'}
                      </EmptyTitle>
                      <EmptyDescription>
                        {published.length
                          ? '换个英雄名或清除筛选试试。'
                          : '攻略发布后，大家就能在这里查看核心流派和天赋建议。'}
                      </EmptyDescription>
                    </EmptyHeader>
                    {published.length ? (
                      <Button
                        className="touch"
                        variant="outline"
                        onClick={() => {
                          setQuery('');
                          setRole('全部');
                          setTier('全部');
                        }}
                      >
                        清除筛选
                      </Button>
                    ) : access.canEdit ? (
                      <Button className="touch" onClick={() => start()}>
                        <Plus />
                        写第一篇攻略
                      </Button>
                    ) : (
                      <a
                        className="text-link"
                        target="_top"
                        href="/signin-with-chatgpt?return_to=%2F"
                      >
                        编辑成员登录 <ArrowRight size={16} />
                      </a>
                    )}
                  </Empty>
                )}
              </>
            )}
          </TabsContent>
          {access.canEdit && (
            <TabsContent value="workspace">
              <section className="intro">
                <div>
                  <p className="eyebrow">EDITOR WORKSPACE</p>
                  <h1>
                    把你的经验，<span>写成攻略。</span>
                  </h1>
                  <p className="muted">
                    {access.displayName} ·{' '}
                    {access.isAdmin ? '管理员' : '编辑成员'}{' '}
                    <a
                      className="inline-link"
                      target="_top"
                      href="/signout-with-chatgpt?return_to=%2F"
                    >
                      退出
                    </a>
                  </p>
                </div>
                <Button className="touch" onClick={() => start()}>
                  <Plus />
                  收录英雄
                </Button>
              </section>
              <div className="workspace-list">
                {records.length ? (
                  records.map((r) => {
                    const h = heroes.find((h) => h.id === r.heroId)!;
                    return (
                      <article className="workspace-row" key={r.heroId}>
                        <img
                          src={h.avatar}
                          alt=""
                          width={50}
                          height={50}
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h2>{r.draft?.title || `${h.name} · 未命名攻略`}</h2>
                          <p>
                            {h.name} · {r.published ? '有公开版本' : '仅草稿'} ·
                            修订 {r.revision}
                          </p>
                        </div>
                        <Button
                          className="touch"
                          variant="outline"
                          onClick={() => start(r)}
                        >
                          继续编辑
                        </Button>
                      </article>
                    );
                  })
                ) : (
                  <Empty className="guide-empty">
                    <EmptyHeader>
                      <EmptyTitle>还没有保存的攻略</EmptyTitle>
                      <EmptyDescription>
                        选择你熟悉的模式英雄，从核心与小天赋开始。
                      </EmptyDescription>
                    </EmptyHeader>
                    <Button className="touch" onClick={() => start()}>
                      <Plus />
                      收录第一个英雄
                    </Button>
                  </Empty>
                )}
              </div>
              {access.isAdmin && <MemberPanel />}
            </TabsContent>
          )}
          <TabsContent value="about">
            <section className="intro">
              <div>
                <p className="eyebrow">OUR PLAYBOOK</p>
                <h1>一起把经验写清楚。</h1>
                <p className="muted">
                  无尽守御天赋与流派攻略，非官方玩家资料。
                </p>
              </div>
            </section>
            {access.signedIn && !access.canEdit && (
              <div className="notice">
                当前账号：{access.displayName}
                。尚未获得编辑权限，请让管理员将你的 ChatGPT
                账号邮箱加入编辑名单。
                <a
                  className="inline-link"
                  target="_top"
                  href="/signout-with-chatgpt?return_to=%2F"
                >
                  退出账号
                </a>
              </div>
            )}
            <div className="about-grid">
              <article className="reference-card">
                <span className="eyebrow">01 / 英雄范围</span>
                <h2>只收录这个模式的英雄</h2>
                <p>
                  不把排位英雄池当作无尽守御英雄池。由编辑确认并发布后，英雄才会在首页展示。
                </p>
              </article>
              <article className="reference-card">
                <span className="eyebrow">02 / 攻略结构</span>
                <h2>核心、天赋与雕文，一起搭配</h2>
                <p>
                  每个流派自由选择天赋，记录选择顺序与搭配说明。还能搭配模式雕文、通用五级铭文与秘法。
                </p>
              </article>
              <article className="reference-card">
                <span className="eyebrow">03 / 版本与来源</span>
                <h2>攻略会随版本变化</h2>
                <p>
                  “作者已核验”表示作者核对过核心、天赋并记录来源，不是官方认证。请结合攻略标注的版本阅读。
                </p>
              </article>
              <article className="reference-card">
                <span className="eyebrow">04 / 协作方式</span>
                <h2>公开阅读，指定成员编辑</h2>
                <p>
                  读者无需登录。编辑使用 ChatGPT
                  账号登录，由管理员按邮箱授权；QQ
                  和微信用于分享链接，不是登录账号。
                </p>
              </article>
            </div>
            <div className="source-note">
              <h3>目前能获取的数据</h3>
              <p>
                官网公开数据仅用于编辑时的英雄名称与头像。天赋、核心流派及模式雕文不从排位资料推断，也不声称已抓取完整数据。
              </p>
              <a
                className="text-link"
                href="https://pvp.qq.com/web201605/js/herolist.json"
                target="_blank"
                rel="noreferrer"
              >
                官网英雄目录
              </a>
              <span> · </span>
              <a
                className="text-link"
                href="https://github.com/lengyibai/wzry"
                target="_blank"
                rel="noreferrer"
              >
                参考仓库
              </a>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <footer>
        <span>
          守御手册 <small>/</small> 把实战经验，写成下一局的答案。
        </span>
        <span>非官方 · 以游戏内当前版本为准</span>
      </footer>
      {editor && (
        <GuideEditor
          initialSkill={editor.initialSkill}
          initialBuildId={editor.initialBuildId}
          newBuild={editor.newBuild}
          key={editor.key}
          record={editor.record}
          onClose={() => setEditor(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
