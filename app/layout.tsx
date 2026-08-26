import type { Metadata } from 'next';
import './globals.css';
import { getAdsenseClientId } from '@/lib/adsense';

const adsenseClientId = getAdsenseClientId();

export const metadata: Metadata = {
  title: 'Java Pleno Pixel Hunt',
  description:
    'Um jogo pixel art de arena sobre sobreviver a usuários, chefes e lançamentos de dados.',
  ...(adsenseClientId
    ? {
        other: {
          'google-adsense-account': adsenseClientId,
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {adsenseClientId && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
