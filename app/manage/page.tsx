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
          <h1>仅站点所有者可管理链接</h1>
          <p>共同编辑无需登录，请使用所有者发给你的专属编辑链接。</p>
          <a href="/">返回攻略</a>
        </section>
      </main>
    );
  return <Notebook mode="manage" />;
}
export default function ManagePage() {
  return <OwnerWorkspace />;
}
