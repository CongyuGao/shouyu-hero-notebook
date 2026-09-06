export const bugStatuses = ['待确认', '已复现', '已修复'] as const;
export type BugStatus = (typeof bugStatuses)[number];
export type BugEntry = {
  id: string;
  title: string;
  body: string;
  status: BugStatus;
  version: string;
  scope: string;
  steps: string;
  workaround: string;
  updatedAt: string;
};
export type BugLibrary = { revision: number; items: BugEntry[] };
export const emptyBugs: BugLibrary = { revision: 0, items: [] };
export const MAX_BUGS = 100;

export function blankBug(): BugEntry {
  return {
    id: crypto.randomUUID(),
    title: '',
    body: '',
    status: '待确认',
    version: '',
    scope: '',
    steps: '',
    workaround: '',
    updatedAt: '',
  };
}

export function validateBugEntry(input: unknown): Omit<BugEntry, 'updatedAt'> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('BUG 记录格式不正确');
  const entry = input as Record<string, unknown>;
  const field = (key: string, label: string, max: number, required = false) => {
    const value = entry[key] ?? '';
    if (typeof value !== 'string' || value.length > max)
      throw new Error(`${label}请控制在${max}字以内`);
    if (required && !value.trim()) throw new Error(`请填写${label}`);
    return value.trim();
  };
  if (!bugStatuses.includes(entry.status as BugStatus))
    throw new Error('请选择待确认、已复现或已修复');
  return {
    id: field('id', '记录编号', 80, true),
    title: field('title', 'BUG 标题', 100, true),
    body: field('body', '问题现象', 6000, true),
    status: entry.status as BugStatus,
    version: field('version', '适用版本', 100),
    scope: field('scope', '相关英雄 / 场景', 300),
    steps: field('steps', '复现步骤', 3000),
    workaround: field('workaround', '临时应对办法', 3000),
  };
}

export function saveBugEntry(
  items: BugEntry[],
  entry: Omit<BugEntry, 'updatedAt'>,
  updatedAt: string,
): BugEntry[] {
  const exists = items.some((item) => item.id === entry.id);
  if (!exists && items.length >= MAX_BUGS)
    throw new Error(`目前最多保留${MAX_BUGS}条 BUG 记录`);
  const saved = { ...entry, updatedAt };
  return exists
    ? items.map((item) => (item.id === entry.id ? saved : item))
    : [saved, ...items];
}
