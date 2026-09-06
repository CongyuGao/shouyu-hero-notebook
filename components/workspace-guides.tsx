'use client';
import {
  FilePenLine,
  CircleCheck,
  Clock3,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { heroes, type GuideRecord } from '@/lib/guide';
export function WorkspaceGuides({
  records,
  onEdit,
  onNew,
}: {
  records: GuideRecord[];
  onEdit: (record: GuideRecord) => void;
  onNew: () => void;
}) {
  const pending = records.filter((r) => r.pendingDraft);
  const published = records.filter((r) => !r.pendingDraft);
  function rows(items: GuideRecord[], draft: boolean) {
    return (
      <div className="workspace-list">
        {items.map((r) => {
          const hero = heroes.find((h) => h.id === r.heroId);
          if (!hero) return null;
          const guide = r.draft || r.published;
          return (
            <article
              className={`workspace-row ${draft ? 'draft-row' : ''}`}
              key={r.heroId}
            >
              <img
                src={hero.avatar}
                alt=""
                width={56}
                height={56}
                referrerPolicy="no-referrer"
              />
              <div className="workspace-guide-copy">
                <div className="workspace-guide-heading">
                  <h3>{hero.name}</h3>
                  <span className={draft ? 'draft-state' : 'published-state'}>
                    {draft
                      ? r.published
                        ? '待发布修改'
                        : '未发布草稿'
                      : '已发布'}
                  </span>
                </div>
                <h2>{guide?.title || '未命名攻略'}</h2>
                <p className="workspace-build-names">
                  {guide?.builds
                    .map((b) => b.name)
                    .filter(Boolean)
                    .join(' / ') || '流派待补充'}
                </p>
                <p className="workspace-saved-at">
                  <Clock3 size={14} />
                  <span>
                    保存于{' '}
                    <time dateTime={r.updatedAt}>
                      {new Date(r.updatedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </time>
                  </span>
                </p>
              </div>
              <Button
                className="touch"
                variant={draft ? 'default' : 'outline'}
                onClick={() => onEdit(r)}
              >
                {draft ? '继续完成' : '编辑攻略'}
                <ArrowRight size={16} />
              </Button>
            </article>
          );
        })}
      </div>
    );
  }
  return (
    <div className="workspace-guide-sections">
      <section
        aria-labelledby="pending-guides-title"
        className="pending-guides"
      >
        <div className="workspace-section-heading">
          <h2 id="pending-guides-title">
            <FilePenLine size={23} />
            待完成攻略 <span>{pending.length}</span>
          </h2>
          <p>草稿仅编辑者可见，写好后再发布。</p>
        </div>
        {pending.length ? (
          rows(pending, true)
        ) : (
          <div className="draft-empty">
            <FilePenLine size={24} />
            <div>
              <strong>暂无待完成草稿</strong>
              <p>编辑到一半点击“保存草稿”，就会保留在这里。</p>
            </div>
            <Button variant="outline" onClick={onNew}>
              <Plus />
              新写攻略
            </Button>
          </div>
        )}
      </section>
      {!!published.length && (
        <section aria-labelledby="published-guides-title">
          <div className="workspace-section-heading">
            <h2 id="published-guides-title">
              <CircleCheck size={22} />
              已发布攻略 <span>{published.length}</span>
            </h2>
          </div>
          {rows(published, false)}
        </section>
      )}
    </div>
  );
}
