export const STALE_GUIDE_DAYS = 30;
export function guideFreshness(publishedAt: string | null, now = Date.now()) {
  if (!publishedAt) return null;
  const time = Date.parse(publishedAt);
  if (!Number.isFinite(time)) return null;
  const days = Math.max(0, Math.floor((now - time) / 86400000));
  return {
    days,
    stale: days >= STALE_GUIDE_DAYS,
    label: days === 0 ? '今天更新' : `${days}天前更新`,
    date: new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Shanghai',
    }).format(new Date(time)),
  };
}
