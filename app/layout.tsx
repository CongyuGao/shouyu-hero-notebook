import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toast';

export const metadata: Metadata = {
  referrer: 'no-referrer',
  title: '守御手册 · 无尽守御英雄资料库',
  description:
    '一起维护无尽守御英雄的天赋、雕文、铭文、秘法与雕文搭配。公开查阅，协作更新。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
