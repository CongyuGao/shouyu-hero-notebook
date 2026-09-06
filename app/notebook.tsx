'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Shield,
  LockKeyhole,
  BookOpen,
  ArrowRight,
  Swords,
  Plus,
  Pencil,
  RefreshCw,
  Bug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { heroes, type Access, type GuideRecord } from '@/lib/guide';
import { GuideView } from '@/components/guide-view';
import { GuideEditor } from '@/components/guide-editor';
import { EditLinkPanel } from '@/components/edit-link-panel';
import { GuidePrimer } from '@/components/guide-primer';
import { HeroLibrary } from '@/components/hero-library';
import { heroTemplate, type GuideEditTarget } from '@/lib/hero-template';
import {
  initialRoster,
  rosterHeroIds,
  type ModeRoster,
} from '@/lib/mode-roster';
import { registerNotebookTools } from '@/lib/webmcp';
import { apiFetch, readResponse } from '@/lib/client-api';
const anonymous: Access = {
  signedIn: false,
  canEdit: false,
  isAdmin: false,
  displayName: '',
};
export default function Notebook({
  mode = 'read',
}: {
  mode?: 'read' | 'edit' | 'manage';
}) {
  const basePath = mode === 'read' ? '/' : `/${mode}`;
  const [records, setRecords] = useState<GuideRecord[]>([]),
    [access, setAccess] = useState(anonymous),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tab, setTab] = useState('overview'),
    [roster, setRoster] = useState<ModeRoster>(initialRoster),
    [selected, setSelected] = useState(''),
    [editor, setEditor] = useState<{
      record: GuideRecord | null;
      key: number;
      initialSkill?: number;
      initialBuildId?: string;
      newBuild?: boolean;
      initialHeroId?: string;
      initialTarget?: GuideEditTarget;
    } | null>(null);
  const refresh = useCallback(async () => {
    try {
      const [j, pool] = await Promise.all([
        apiFetch('/api/guides', { cache: 'no-store' }).then((r) =>
          readResponse<{ guides: GuideRecord[]; access: Access }>(r),
        ),
        apiFetch('/api/roster', { cache: 'no-store' }).then((r) =>
          readResponse<ModeRoster>(r),
        ),
      ]);
      setRoster(pool);
      setRecords(j.guides);
      setAccess(mode === 'read' ? anonymous : j.access);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [mode]);
  useEffect(() => {
    void refresh();
    const read = () => {
      const params = new URL(location.href).searchParams;
      const heroId = params.get('hero') || '';
      setSelected(heroId);
      if (heroId) setTab('guides');
      else
        setTab(
          ['guides', 'bugs', 'workspace', 'about'].includes(
            params.get('page') || '',
          )
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
      id
        ? `${basePath}?hero=${encodeURIComponent(id)}`
        : `${basePath}?page=guides`,
    );
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function start(
    record: GuideRecord | null = null,
    initialSkill = 1,
    initialBuildId?: string,
    initialTarget?: GuideEditTarget,
  ) {
    setEditor({
      record,
      key: Date.now(),
      initialSkill,
      initialBuildId,
      initialTarget,
    });
  }
  useEffect(() => {
    if (!access.canEdit || loading) return;
    const url = new URL(location.href);
    if (url.searchParams.get('edit') !== '1') return;
    const target = records.find(
      (r) => r.heroId === url.searchParams.get('hero'),
    );
    if (target) setEditor({ record: target, key: Date.now(), initialSkill: 1 });
    else if (rosterHeroIds(roster).includes(url.searchParams.get('hero') || ''))
      setEditor({
        record: null,
        key: Date.now(),
        initialHeroId: url.searchParams.get('hero')!,
      });
    url.searchParams.delete('edit');
    history.replaceState(null, '', url.pathname + url.search);
  }, [access.canEdit, loading, records, roster]);
  const state = useRef({
    records,
    access,
    openGuide,
    start,
    modeHeroIds: rosterHeroIds(roster),
  });
  state.current = {
    records,
    access,
    openGuide,
    start,
    modeHeroIds: rosterHeroIds(roster),
  };
  useEffect(() => registerNotebookTools(() => state.current), []);
  const poolIds = rosterHeroIds(roster);
  const active = poolIds.includes(selected)
    ? records.find((r) => r.heroId === selected)
    : undefined;
  const activeGuide = active?.published;
  const pendingHero = poolIds.includes(selected)
    ? heroes.find((h) => h.id === selected)
    : undefined;
  const templateRecord =
    pendingHero && !activeGuide ? heroTemplate(selected) : null;
  return (
    <div className="notebook">
      <header className="topbar">
        <a className="brand" href={basePath}>
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
        ) : (
          <span className="reader-mode">
            <LockKeyhole size={15} />
            只读攻略
          </span>
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
              page === 'overview'
                ? basePath
                : `${basePath}?page=${encodeURIComponent(page)}`,
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
              <TabsTrigger value="bugs">
                <Bug />
                BUG 说明
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
              {access.canEdit ? '编辑模式 · 修改后请保存' : '公开查阅'}
            </span>
          </div>
          {mode !== 'read' && (
            <div className="editing-mode-banner">
              <span>
                {mode === 'manage' ? '所有者工作台' : '专属链接编辑模式'}
              </span>
              <a href="/">打开普通只读页面</a>
              {mode === 'edit' && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await readResponse(
                        await apiFetch('/api/edit-session', {
                          method: 'DELETE',
                        }),
                      );
                      location.assign('/');
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  退出编辑
                </Button>
              )}
            </div>
          )}
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
                    ? (skill, buildId, target) =>
                        start(active, skill, buildId, target)
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
            ) : templateRecord && !loading ? (
              <GuideView
                key={`template-${selected}`}
                guide={templateRecord.draft!}
                record={templateRecord}
                template
                onBack={() => openGuide('')}
                onEdit={
                  access.canEdit
                    ? (skill = 1, _buildId, target) =>
                        setEditor({
                          record: active || null,
                          key: Date.now(),
                          initialHeroId: selected,
                          initialSkill: skill,
                          initialTarget: target,
                        })
                    : undefined
                }
                onNewBuild={
                  access.canEdit
                    ? () =>
                        setEditor({
                          record: active || null,
                          key: Date.now(),
                          initialHeroId: selected,
                          newBuild: !!active,
                        })
                    : undefined
                }
              />
            ) : (
              <>
                {selected && !loading && (
                  <div className="notice">
                    该英雄不在当前模式英雄池中。
                    <Button
                      variant="ghost"
                      className="touch"
                      onClick={() => openGuide('')}
                    >
                      返回英雄图鉴
                    </Button>
                  </div>
                )}
                <HeroLibrary
                  roster={roster}
                  records={records}
                  editable={access.canEdit}
                  loading={loading}
                  onRosterSaved={setRoster}
                  onOpen={openGuide}
                />
              </>
            )}
          </TabsContent>
          <TabsContent value="bugs">
            <section className="intro">
              <div>
                <p className="eyebrow">无尽守御 · 异常记录</p>
                <h1>BUG 说明</h1>
                <p className="muted">
                  后续补充已知异常、复现条件、影响范围与临时应对办法。
                </p>
              </div>
            </section>
            <section className="reference-card bug-placeholder">
              <Bug size={30} />
              <h2>内容待补充</h2>
              <p>
                此处先预留入口，暂不列出未经核实的
                BUG。后续记录会注明版本，并区分待确认、已复现与已修复。
              </p>
            </section>
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
                    {access.isAdmin ? '站点所有者' : '无需登录'}{' '}
                    {access.isAdmin && (
                      <a
                        className="inline-link"
                        target="_top"
                        href="/signout-with-chatgpt?return_to=%2F"
                      >
                        退出
                      </a>
                    )}
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
              {access.isAdmin && <EditLinkPanel />}
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
            <div className="about-grid">
              <article className="reference-card">
                <span className="eyebrow">01 / 英雄范围</span>
                <h2>只收录这个模式的英雄</h2>
                <p>
                  只展示团队确认的模式英雄池，分三批每周轮换。未发布攻略的英雄保留头像入口，后续逐步补全。
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
                <h2>普通链接阅读，专属链接共建</h2>
                <p>
                  普通链接只能查看攻略。收到有效编辑链接的人无需账号即可修改内容。编辑链接请私下分享；到期或被所有者作废后不能继续编辑。
                </p>
              </article>
            </div>
            <div className="source-note">
              <h3>目前能获取的数据</h3>
              <p>
                官网公开数据仅用于英雄名称与头像。天赋、核心流派及模式雕文不从排位资料推断，也不声称已抓取完整数据。
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
        <span>
          非官方 · 以游戏内当前版本为准 ·{' '}
          <a href="/manage?page=workspace">站点管理</a>
        </span>
      </footer>
      {editor && (
        <GuideEditor
          allowedHeroIds={rosterHeroIds(roster)}
          initialHeroId={editor.initialHeroId}
          initialTarget={editor.initialTarget}
          initialSkill={editor.initialSkill}
          initialBuildId={editor.initialBuildId}
          newBuild={editor.newBuild}
          key={editor.key}
          record={editor.record}
          onClose={() => setEditor(null)}
          onSaved={refresh}
          onSaveComplete={(action) => {
            setEditor(null);
            toast.add({
              title: action === 'publish' ? '发布成功' : '保存成功',
              description:
                action === 'publish'
                  ? '玩家现在可以阅读新攻略。'
                  : '草稿已更新，公开版本保持不变。',
              type: 'success',
            });
          }}
        />
      )}
    </div>
  );
}
