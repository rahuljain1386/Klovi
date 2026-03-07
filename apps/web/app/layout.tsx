import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Klovi - Run Your Home Business Like a Pro',
  description: 'The complete operating system for home-based businesses. Booking, payments, AI messaging, marketing - all in one place.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
