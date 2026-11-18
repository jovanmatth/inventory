import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PIGEON - Practical Inventory, Goods & Equipment Organizer',
  description: 'Sistem Pengelolaan & Pemantauan Inventaris ICT Lab 1 & 2 - Sekolah Mutiara Bangsa',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
