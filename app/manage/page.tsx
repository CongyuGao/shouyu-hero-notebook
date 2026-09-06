import Notebook from '@/app/notebook';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { adminEmail } from '@/db';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
async function OwnerWorkspace() {
  const user = await requireChatGPTUser('/manage?page=workspace');
  if (!adminEmail() || user.email.toLowerCase() !== adminEmail())
    return (
      <main className="main-wrap">
        <section className="reference-card">
          <h1>只有站点所有者可以管理权限</h1>
          <p>共同编辑无需登录，请使用所有者分享的编辑密码或有效编辑链接。</p>
          <a href="/edit?page=workspace">输入密码编辑</a>
          <a href="/">返回攻略</a>
        </section>
      </main>
    );
  return <Notebook mode="manage" />;
}
export default function ManagePage() {
  return <OwnerWorkspace />;
}
