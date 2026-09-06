'use client';
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  guideSkillLabels,
  heroSkills,
  MAX_SKILL_LABEL_LENGTH,
  skillLabels,
  validateSkillLabels,
  type Guide,
} from '@/lib/guide';

export function SkillLabelEditor({
  guide,
  disabled,
  onChange,
}: {
  guide: Guide;
  disabled?: boolean;
  onChange: (patch: Partial<Guide>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const groups = [
    ...heroSkills(guide.heroId),
    ...(guide.talents.some((t) => !t.skill) ? [0] : []),
  ];
  function apply() {
    if (disabled) return;
    try {
      onChange({ skillLabels: validateSkillLabels(names), verified: false });
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="touch"
        disabled={disabled}
        onClick={() => {
          const labels = guideSkillLabels(guide);
          setNames(
            Object.fromEntries(groups.map((skill) => [skill, labels[skill]])),
          );
          setError('');
          setOpen(true);
        }}
      >
        <Pencil size={16} />
        编辑技能名称
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="skill-label-dialog scrollable-site-dialog">
          <DialogHeader>
            <DialogTitle>编辑技能分组名称</DialogTitle>
            <DialogDescription>
              可将“一技能”改成“二技能”，或填写自己的名称。修改用于本英雄所有流派和攻略图，应用后记得保存或发布。
            </DialogDescription>
          </DialogHeader>
          <div className="skill-label-fields">
            {groups.map((skill, index) => {
              const examples = guide.cores
                .filter((c) => c.skill === skill && c.name)
                .map((c) => c.name);
              if (!examples.length)
                examples.push(
                  ...guide.talents
                    .filter((t) => (t.skill || 0) === skill && t.name)
                    .slice(0, 2)
                    .map((t) => t.name),
                );
              return (
                <label className="field skill-label-field" key={skill}>
                  <span>第 {index + 1} 组 · 显示名称</span>
                  <Input
                    value={names[skill] || ''}
                    maxLength={MAX_SKILL_LABEL_LENGTH}
                    placeholder={skillLabels[skill]}
                    onChange={(e) =>
                      setNames({ ...names, [skill]: e.target.value })
                    }
                  />
                  {examples.length > 0 && (
                    <small>本组内容：{examples.join(' / ')}</small>
                  )}
                </label>
              );
            })}
          </div>
          <p className="muted">
            留空恢复默认名称。每组的核心、小天赋和已选搭配会一起沿用新名称。
          </p>
          {error && (
            <p role="alert" className="notice">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              className="touch"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="touch"
              disabled={disabled}
              onClick={apply}
            >
              应用修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
