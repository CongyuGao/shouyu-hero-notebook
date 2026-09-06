'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Shield,
  Eye,
  Link2,
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
import { heroes, type Access, type GuideRecord } from '@/lib/guide';
import { GuideView } from '@/components/guide-view';
import { GuideEditor } from '@/components/guide-editor';
import { EditLinkPanel } from '@/components/edit-link-panel';
import { OwnerPasswordPanel } from '@/components/owner-password-panel';
import { isCloudflareDeployment } from '@/lib/deployment';
import { WorkspaceGuides } from '@/components/workspace-guides';
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
  useEffect(() => {
    if (mode !== 'edit' && !(mode === 'manage' && isCloudflareDeployment))
      return;
    let stopped = false;
    async function checkAccess() {
      if (document.visibilityState === 'hidden') return;
      try {
        const result = await readResponse<{ active: boolean }>(
          await apiFetch(
            mode === 'manage' ? '/api/owner-session' : '/api/edit-session',
            { cache: 'no-store' },
          ),
        );
        if (!stopped && !result.active) {
          setAccess(anonymous);
          setError(
            '编辑权限已失效，当前未保存内容仍保留。请先导出或复制内容，再使用新密码重新验证。',
          );
        }
      } catch {
        /* A transient network failure must not discard an open draft. */
      }
    }
    const interval = setInterval(() => void checkAccess(), 15000);
    window.addEventListener('focus', checkAccess);
    return () => {
      stopped = true;
      clearInterval(interval);
      window.removeEventListener('focus', checkAccess);
    };
  }, [mode]);
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
  const readHref = selected
    ? `/?hero=${encodeURIComponent(selected)}`
    : ['guides', 'bugs', 'about'].includes(tab)
      ? `/?page=${tab}`
      : '/';
  function openWorkspace() {
    setTab('workspace');
    setSelected('');
    history.pushState(null, '', `${basePath}?page=workspace`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
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
        <nav className="mode-navigation" aria-label="查看与编辑">
          <a
            href={readHref}
            aria-current={mode === 'read' ? 'page' : undefined}
          >
            <Eye size={17} /> 只读查看
          </a>
          {access.canEdit ? (
            <Button className="touch" variant="outline" onClick={openWorkspace}>
              {access.isAdmin ? <Link2 /> : <Pencil />}
              {access.isAdmin ? '管理 / 分享' : '编辑工作台'}
            </Button>
          ) : (
            <a
              className="owner-entry"
              href={
                selected
                  ? `/edit?hero=${encodeURIComponent(selected)}`
                  : '/edit?page=workspace'
              }
            >
              <Pencil size={17} /> 编辑攻略
            </a>
          )}
        </nav>
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
                {mode === 'manage'
                  ? '所有者工作台'
                  : access.canEdit
                    ? '已验证 · 编辑模式'
                    : '编辑权限已失效'}
              </span>
              <a href={readHref}>切换为只读查看</a>
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
                        href={
                          isCloudflareDeployment
                            ? '/manage'
                            : '/signout-with-chatgpt?return_to=%2F'
                        }
                        onClick={
                          isCloudflareDeployment
                            ? async (event) => {
                                event.preventDefault();
                                try {
                                  await readResponse(
                                    await apiFetch('/api/owner-session', {
                                      method: 'DELETE',
                                    }),
                                  );
                                  location.assign('/');
                                } catch (e) {
                                  setError((e as Error).message);
                                }
                              }
                            : undefined
                        }
                      >
                        退出
                      </a>
                    )}
                  </p>
                </div>
                <div className="button-row">
                  {access.isAdmin && (
                    <a className="auth-link" href="#sharing-settings">
                      <Link2 size={17} />
                      密码与分享设置
                    </a>
                  )}
                  <Button className="touch" onClick={() => openGuide('')}>
                    <Pencil /> 选择英雄编辑
                  </Button>
                  <Button
                    className="touch"
                    variant="outline"
                    onClick={() => start()}
                  >
                    <Plus /> 新写攻略
                  </Button>
                </div>
              </section>
              <section
                className="workspace-mode-control"
                aria-label="我的查看方式"
              >
                <div>
                  <strong>
                    <Pencil size={17} /> 当前可编辑
                  </strong>
                  <p>
                    选择英雄后可修改核心、天赋和搭配。只读预览只切换你的查看方式，不改变别人链接的权限。
                  </p>
                </div>
                <a className="auth-link" href="/">
                  <Eye size={17} /> 只读预览
                </a>
              </section>
              <WorkspaceGuides
                records={records}
                onEdit={(record) => start(record)}
                onNew={() => start()}
              />
              {access.isAdmin && <EditLinkPanel />}
              {access.isAdmin && isCloudflareDeployment && (
                <OwnerPasswordPanel />
              )}
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
                <h2>公开阅读，验证后共建</h2>
                <p>
                  普通链接只能查看已发布攻略。输入编辑密码或使用有效编辑链接后即可修改内容，无需账号。只有所有者可以修改密码；换密码后旧权限立即失效。
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
          <small className="creator-credit">网站创作者 · 漫游的逗号</small>
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
            if (action === 'draft') openWorkspace();
            toast.add({
              title: action === 'publish' ? '发布成功' : '保存成功',
              description:
                action === 'publish'
                  ? '玩家现在可以阅读新攻略。'
                  : '已放入工作台的“待完成攻略”，下次可继续编辑。公开版本保持不变。',
              type: 'success',
            });
          }}
        />
      )}
    </div>
  );
}
