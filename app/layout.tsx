import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Java Pleno Pixel Hunt',
  description:
    'Um jogo pixel art de arena sobre sobreviver a usuarios, chefes e lancamentos de dados.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
