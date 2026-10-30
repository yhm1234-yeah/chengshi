import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: '城事 · AI 城市治理随手拍',
  description:
    '「城事」是一个 AI 驱动的城市治理随手拍参与平台：市民拍照上报，AI 识别立案、Agent 分派、人工复核、全程可追溯。',
  applicationName: '城事',
  keywords: ['城市治理', '随手拍', 'AI 识别', '多 Agent', '工单分派', '政务']
};

export const viewport: Viewport = {
  themeColor: '#4C5DF0',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
