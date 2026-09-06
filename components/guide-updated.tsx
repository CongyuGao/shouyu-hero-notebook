import { Clock3 } from 'lucide-react';
import { guideFreshness, STALE_GUIDE_DAYS } from '@/lib/guide-freshness';
export function GuideUpdated({
  publishedAt,
  compact = false,
}: {
  publishedAt: string | null;
  compact?: boolean;
}) {
  const freshness = guideFreshness(publishedAt);
  if (!freshness) return <span className="guide-updated">尚未公开发布</span>;
  return (
    <div
      className={`guide-updated ${freshness.stale ? 'may-be-outdated' : ''} ${compact ? 'is-compact' : ''}`}
    >
      <span>
        <Clock3 size={14} />
        攻略最近更新 <time dateTime={publishedAt!}>{freshness.date}</time>
        <small>{freshness.label}</small>
      </span>
      {freshness.stale && (
        <p>
          {compact
            ? '超过30天未更新 · 留意版本变化'
            : `已超过${STALE_GUIDE_DAYS}天未更新，攻略可能受版本变化影响，请结合文中版本与核验记录参考。`}
        </p>
      )}
    </div>
  );
}
