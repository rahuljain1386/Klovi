'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { t } from '@/lib/i18n';

const navItems = [
  { href: '/dashboard', key: 'nav.home', icon: '🏠' },
  { href: '/dashboard/orders', key: 'nav.orders', icon: '📋' },
  { href: '/dashboard/inbox', key: 'nav.inbox', icon: '💬' },
  { href: '/dashboard/settings', key: 'nav.settings', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sellerName, setSellerName] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: seller } = await supabase
        .from('sellers')
        .select('business_name, status, language')
        .eq('user_id', user.id)
        .single();

      if (!seller) {
        router.push('/auth/signup');
        return;
      }

      if (seller.status === 'onboarding') {
        router.push('/onboarding');
        return;
      }

      setSellerName(seller.business_name);
      setLanguage(seller.language || 'en');
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-warm-gray text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-white border-r border-[#e7e0d4] flex-col fixed h-full z-30">
        <div className="p-6 border-b border-[#e7e0d4]">
          <Link href="/" className="font-display text-2xl text-ink">Klovi</Link>
          {sellerName && (
            <p className="text-sm text-warm-gray mt-1 truncate">{sellerName}</p>
          )}
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber/10 text-ink border-r-2 border-amber'
                    : 'text-warm-gray hover:text-ink hover:bg-cream/50'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {t(item.key, language)}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#e7e0d4]">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-warm-gray hover:text-rose transition-colors rounded-lg hover:bg-rose/5"
          >
            {t('nav.logout', language)}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-[#e7e0d4] z-30 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-display text-xl text-ink">Klovi</Link>
        {sellerName && (
          <p className="text-sm text-warm-gray truncate max-w-[180px]">{sellerName}</p>
        )}
      </header>

      {/* Main content */}
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 py-5 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar — 4 items: Home, Orders, Inbox, Settings */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e7e0d4] z-30 flex items-center justify-around px-1 py-1.5 safe-area-pb">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[56px] ${
                isActive ? 'text-amber' : 'text-warm-gray'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium">{t(item.key, language)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
