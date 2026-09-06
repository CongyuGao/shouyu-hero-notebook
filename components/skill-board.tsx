'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  Gem,
  Pencil,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GameIcon } from '@/components/game-icon';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  chooseTalent,
  MAX_SELECTED_TALENTS,
  selectedTalents,
  type Build,
  type Guide,
} from '@/lib/guide';

type Editing = {
  kind: 'core' | 'talent';
  id: string;
  name: string;
  description: string;
  skill: number;
  reason: string;
};
const skillNames = ['未分组', '一技能', '二技能', '三技能'];
const skillIcons = [Gem, Swords, Shield, Zap];

export function SkillBoard({
  guide,
  build,
  editable = false,
  onGuideChange,
  onBuildChange,
  onEdit,
  initialSkill = 1,
  disabled = false,
  initialEdit,
  onInitialEditOpened,
  onEditItem,
  signInHref,
}: {
  guide: Guide;
  build: Build;
  editable?: boolean;
  onGuideChange?: (patch: Partial<Guide>) => void;
  onBuildChange?: (patch: Partial<Build>) => void;
  onEdit?: (skill: number) => void;
  initialSkill?: number;
  disabled?: boolean;
  initialEdit?: { kind: 'core' | 'talent'; id: string };
  onInitialEditOpened?: () => void;
  onEditItem?: (
    skill: number,
    target: { kind: 'core' | 'talent'; id: string },
  ) => void;
  signInHref?: string;
}) {
  const [skill, setSkill] = useState(String(initialSkill));
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState('');
  const [selectionNotice, setSelectionNotice] = useState('');
  const talentIds = selectedTalents(build);
  const groups = [1, 2, 3, ...(guide.talents.some((t) => !t.skill) ? [0] : [])];
  function toggleTalent(id: string, checked: boolean) {
    if (disabled || !editable) return;
    try {
      onBuildChange?.(chooseTalent(build, id, checked));
    } catch (e) {
      setSelectionNotice((e as Error).message);
    }
  }
  function chooseCore(id: string, checked: boolean) {
    if (disabled || !editable) return;
    const core = guide.cores.find((c) => c.id === id);
    if (!core) return;
    onBuildChange?.({
      coreIds: checked
        ? [
            ...(build.coreIds || []).filter(
              (other) =>
                guide.cores.find((c) => c.id === other)?.skill !== core.skill,
            ),
            id,
          ]
        : (build.coreIds || []).filter((other) => other !== id),
    });
  }
  function open(kind: 'core' | 'talent', id: string) {
    const item =
      kind === 'core'
        ? guide.cores.find((c) => c.id === id)
        : guide.talents.find((t) => t.id === id);
    if (!item) return;
    const pick = build.picks.find((p) => p.talentId === id);
    setEditing({
      kind,
      id,
      name: item.name,
      description: item.description,
      skill: item.skill || 0,
      reason: pick?.priority === 'selected' ? '' : pick?.reason || '',
    });
    setError('');
  }
  function applyEdit() {
    if (!editing || disabled) return;
    if (!editing.name.trim()) {
      setError('请填写名称。');
      return;
    }
    if (
      editing.kind === 'talent' &&
      guide.talents.some(
        (t) => t.id !== editing.id && t.name.trim() === editing.name.trim(),
      )
    ) {
      setError('已有同名天赋，请确认名称。');
      return;
    }
    if (editing.kind === 'core') {
      onGuideChange?.({
        verified: false,
        cores: guide.cores.map((c) =>
          c.id === editing.id
            ? {
                ...c,
                name: editing.name.trim(),
                description: editing.description.trim(),
              }
            : c,
        ),
      });
    } else {
      onGuideChange?.({
        verified: false,
        talents: guide.talents.map((t) =>
          t.id === editing.id
            ? {
                ...t,
                name: editing.name.trim(),
                description: editing.description.trim(),
                skill: editing.skill || undefined,
              }
            : t,
        ),
      });
      onBuildChange?.({
        picks: [
          ...build.picks.filter((p) => p.talentId !== editing.id),
          {
            talentId: editing.id,
            priority: 'none',
            reason: editing.reason.trim(),
          },
        ],
      });
    }
    setEditing(null);
  }
  useEffect(() => {
    if (!editable || !initialEdit) return;
    open(initialEdit.kind, initialEdit.id);
    onInitialEditOpened?.();
  }, [initialEdit]);
  return (
    <div className={`skill-board ${editable ? 'is-editing' : ''}`}>
      <div className="board-toolbar">
        <div>
          <h2>{editable ? '搭配你的天赋' : '核心与天赋'}</h2>
          <p>
            {editable
              ? '勾选加入本流派，点击铅笔修改名称、效果与取舍。'
              : '按技能查看核心与对应小天赋。'}
          </p>
        </div>
        <div className="board-selection-summary">
          <span
            className={`talent-total-counter ${talentIds.length >= MAX_SELECTED_TALENTS ? 'is-full' : ''}`}
            aria-live="polite"
          >
            小天赋 <strong>{talentIds.length}</strong> / {MAX_SELECTED_TALENTS}
            {talentIds.length >= MAX_SELECTED_TALENTS && <small>已选满</small>}
          </span>
          {!editable && (
            <Button
              className="touch"
              variant={selectedOnly ? 'default' : 'outline'}
              aria-pressed={selectedOnly}
              onClick={() => setSelectedOnly(!selectedOnly)}
            >
              {selectedOnly ? '显示全部' : '只看已选'}
            </Button>
          )}
        </div>
      </div>
      <Tabs
        value={groups.includes(Number(skill)) ? skill : '1'}
        onValueChange={(v) => setSkill(String(v))}
      >
        <TabsList className="skill-tabs">
          {groups.map((n) => {
            const Icon = skillIcons[n];
            return (
              <TabsTrigger value={String(n)} key={n}>
                <Icon size={18} />
                <span>{skillNames[n]}</span>
                <small>
                  {
                    guide.talents.filter(
                      (t) => (t.skill || 0) === n && talentIds.includes(t.id),
                    ).length
                  }{' '}
                  已选
                </small>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {groups.map((n) => {
          const cores = (guide.cores || []).filter((c) => c.skill === n);
          const talents = guide.talents.filter((t) => (t.skill || 0) === n);
          const shown = talents.filter(
            (t) => !selectedOnly || talentIds.includes(t.id),
          );
          const Icon = skillIcons[n];
          return (
            <TabsContent
              key={n}
              value={String(n)}
              className={`skill-panel skill-tone-${n}`}
            >
              <header className="skill-panel-heading">
                <span className="skill-medallion">
                  <Icon size={26} />
                </span>
                <div>
                  <span className="skill-kicker">
                    SKILL {String(n).padStart(2, '0')}
                  </span>
                  <h3>
                    {skillNames[n]} <span>· 天赋配置</span>
                  </h3>
                </div>
                {onEdit && (
                  <Button
                    variant="outline"
                    className="touch"
                    onClick={() => onEdit(n)}
                  >
                    <Pencil size={16} />
                    调整本技能
                  </Button>
                )}
              </header>
              {!!cores.length && (
                <>
                  <div className="board-section-label core-section-label">
                    <span>
                      <Gem size={16} />
                      流派核心
                    </span>
                    <small>本技能选择一个核心</small>
                  </div>
                  <div className="power-core-grid">
                    {cores.map((c) => {
                      const picked = (build.coreIds || []).includes(c.id);
                      return (
                        <article
                          className={`power-core ${picked ? 'is-selected' : 'is-unselected'}`}
                          key={c.id}
                        >
                          <div className="power-card-top">
                            <span className="power-symbol">
                              <GameIcon kind="core" />
                            </span>
                            <span className="selection-chip">
                              {picked ? (
                                <>
                                  <Check size={14} />
                                  已选核心
                                </>
                              ) : (
                                '未选'
                              )}
                            </span>
                          </div>
                          <h4>
                            {editable ? (
                              <Button
                                variant="ghost"
                                className="core-name-select"
                                disabled={disabled}
                                onClick={() => chooseCore(c.id, !picked)}
                                aria-label={`${picked ? '取消选择' : '选择'}核心${c.name || c.id}`}
                              >
                                {c.name || '未命名核心'}
                              </Button>
                            ) : (
                              c.name || '未命名核心'
                            )}
                          </h4>
                          <p className="power-description preserve">
                            {c.description || '效果待补充'}
                          </p>
                          {editable && (
                            <div className="power-card-actions">
                              <label className="pick-control">
                                <Checkbox
                                  disabled={disabled}
                                  checked={picked}
                                  onCheckedChange={(v) => chooseCore(c.id, !!v)}
                                />
                                <span>
                                  {picked ? '已加入流派' : '选择此核心'}
                                </span>
                              </label>
                              <Button
                                variant="ghost"
                                className="card-edit-button touch"
                                disabled={disabled}
                                aria-label={`编辑核心${c.name || c.id}名称与描述`}
                                onClick={() => open('core', c.id)}
                              >
                                <Pencil size={15} />
                                编辑描述
                              </Button>
                            </div>
                          )}
                          {!editable && onEditItem && (
                            <Button
                              variant="outline"
                              className="touch card-edit-button"
                              onClick={() =>
                                onEditItem(n, { kind: 'core', id: c.id })
                              }
                            >
                              <Pencil size={15} />
                              {c.name ? '编辑核心资料' : '添加核心资料'}
                            </Button>
                          )}
                          {!editable && !onEditItem && signInHref && (
                            <a
                              className="template-edit-link"
                              href={signInHref}
                              target="_top"
                            >
                              <Pencil size={14} />
                              登录后添加核心
                            </a>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  {!editable &&
                    !cores.some((c) =>
                      (build.coreIds || []).includes(c.id),
                    ) && <p className="empty-inline">本技能尚未选择核心。</p>}
                </>
              )}
              <div className="board-section-label talent-section-label">
                <span>
                  <Sparkles size={16} />
                  小天赋
                </span>
                <small>
                  已选 {talents.filter((t) => talentIds.includes(t.id)).length}{' '}
                  / {talents.length}
                </small>
              </div>
              <div className="power-talent-grid">
                {shown.map((t) => {
                  const picked = talentIds.includes(t.id),
                    p = build.picks.find((p) => p.talentId === t.id);
                  return (
                    <article
                      className={`power-talent ${picked ? 'is-selected' : ''}`}
                      key={t.id}
                    >
                      <div className="power-card-top">
                        <span className="talent-sigil">
                          <GameIcon kind="talent" />
                        </span>
                        <span className="selection-chip">
                          {picked ? (
                            <>
                              <Check size={14} />
                              已选
                            </>
                          ) : (
                            '未选'
                          )}
                        </span>
                      </div>
                      <h4>{t.name || '未命名天赋'}</h4>
                      <p className="power-description preserve">
                        {t.description || '效果待补充'}
                      </p>
                      {p?.reason && p.priority !== 'selected' && (
                        <div className="power-reason">
                          <span>搭配说明</span>
                          <p className="preserve">{p.reason}</p>
                        </div>
                      )}
                      {editable && (
                        <div className="power-card-actions">
                          <label className="pick-control">
                            <Checkbox
                              disabled={disabled}
                              checked={picked}
                              onCheckedChange={(v) => toggleTalent(t.id, !!v)}
                            />
                            <span>{picked ? '已选入' : '选入流派'}</span>
                          </label>
                          <Button
                            variant="ghost"
                            className="card-edit-button touch"
                            disabled={disabled}
                            aria-label={`编辑天赋${t.name || t.id}名称描述与说明`}
                            onClick={() => open('talent', t.id)}
                          >
                            <Pencil size={15} />
                            编辑
                          </Button>
                        </div>
                      )}
                      {!editable && onEditItem && (
                        <Button
                          variant="outline"
                          className="touch card-edit-button"
                          onClick={() =>
                            onEditItem(n, { kind: 'talent', id: t.id })
                          }
                        >
                          <Pencil size={15} />
                          {t.name ? '编辑天赋资料' : '添加小天赋'}
                        </Button>
                      )}
                      {!editable && !onEditItem && signInHref && (
                        <a
                          className="template-edit-link"
                          href={signInHref}
                          target="_top"
                        >
                          <Pencil size={14} />
                          登录后添加天赋
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
              {!shown.length && (
                <p className="empty-inline">
                  {selectedOnly
                    ? '本技能尚未选择小天赋，可切换“显示全部”。'
                    : '暂无小天赋，可在“英雄资料”增加栏位并分配技能。'}
                </p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
      <AlertDialog
        open={!!selectionNotice}
        onOpenChange={(open) => {
          if (!open) setSelectionNotice('');
        }}
      >
        <AlertDialogContent className="talent-limit-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>小天赋已选满</AlertDialogTitle>
            <AlertDialogDescription>{selectionNotice}</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="talent-limit-note">
            刚才的选择没有加入，你原有的6个小天赋保持不变。
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="touch"
              onClick={() => setSelectionNotice('')}
            >
              返回调整
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="talent-detail-editor" showCloseButton={false}>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editing.kind === 'core' ? '编辑流派核心' : '编辑小天赋'}
                </DialogTitle>
                <DialogDescription>
                  名称与效果对所有流派生效；搭配说明只属于当前流派，可不填写。应用后记得保存草稿或发布。
                </DialogDescription>
              </DialogHeader>
              <div className="detail-edit-fields">
                <label className="field" htmlFor="talent-detail-name">
                  <span>名称</span>
                  <Input
                    id="talent-detail-name"
                    value={editing.name}
                    maxLength={60}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                  />
                </label>
                <label className="field" htmlFor="talent-detail-description">
                  <span>效果描述</span>
                  <Textarea
                    id="talent-detail-description"
                    rows={5}
                    value={editing.description}
                    maxLength={editing.kind === 'core' ? 2000 : 1600}
                    onChange={(e) =>
                      setEditing({ ...editing, description: e.target.value })
                    }
                  />
                </label>
                {editing.kind === 'talent' && (
                  <>
                    <label className="field" htmlFor="talent-detail-skill">
                      <span>所属技能</span>
                      <Select
                        value={String(editing.skill)}
                        onValueChange={(v) =>
                          setEditing({ ...editing, skill: Number(v) })
                        }
                      >
                        <SelectTrigger
                          id="talent-detail-skill"
                          aria-label="所属技能"
                        >
                          <SelectValue>{skillNames[editing.skill]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {skillNames.map((name, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="field" htmlFor="talent-detail-reason">
                      <span>搭配说明（选填）</span>
                      <Textarea
                        id="talent-detail-reason"
                        value={editing.reason}
                        maxLength={1200}
                        rows={3}
                        onChange={(e) =>
                          setEditing({ ...editing, reason: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {error && (
                  <p role="alert" className="notice">
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="touch"
                  onClick={() => setEditing(null)}
                >
                  取消
                </Button>
                <Button
                  className="touch"
                  disabled={disabled}
                  onClick={applyEdit}
                >
                  应用修改
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
