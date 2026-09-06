import { json } from '@/lib/server';
// Legacy grants are retained in storage for recovery, but no longer authorize edits.
export function GET() {
  return json({ error: '邮箱授权已停用，请使用专属编辑链接。' }, 410);
}
export function POST() {
  return json({ error: '邮箱授权已停用，请使用专属编辑链接。' }, 410);
}
