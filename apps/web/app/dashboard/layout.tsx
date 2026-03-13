'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/orders', label: 'Orders', icon: '📋' },
  { href: '/dashboard/inbox', label: 'Inbox', icon: '💬' },
  { href: '/dashboard/products', label: 'Products', icon: '📦' },
  { href: '/dashboard/customers', label: 'Customers', icon: '👥' },
  { href: '/dashboard/broadcasts', label: 'Broadcasts', icon: '📢' },
  { href: '/dashboard/posts', label: 'Posts', icon: '🎨' },
  { href: '/dashboard/reviews', label: 'Reviews', icon: '⭐' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

// Bottom tab bar shows top 5 items on mobile
const mobileNavItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/orders', label: 'Orders', icon: '📋' },
  { href: '/dashboard/inbox', label: 'Inbox', icon: '💬' },
  { href: '/dashboard/products', label: 'Products', icon: '📦' },
  { href: '/dashboard/settings', label: 'More', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sellerName, setSellerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        .select('business_name, status')
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
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#e7e0d4]">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-warm-gray hover:text-rose transition-colors rounded-lg hover:bg-rose/5"
          >
            Log out
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

      {/* Mobile slide-up menu (from More tab) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl pb-6 pt-3 max-h-[70vh] overflow-y-auto">
            <div className="w-10 h-1 bg-warm-gray/30 rounded-full mx-auto mb-4" />
            <nav className="px-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium ${
                      isActive ? 'bg-amber/10 text-ink' : 'text-warm-gray'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-6 pt-3 mt-2 border-t border-[#e7e0d4]">
              <button
                onClick={handleLogout}
                className="w-full text-left py-3 text-base text-rose font-medium"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 py-5 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e7e0d4] z-30 flex items-center justify-around px-1 py-1.5 safe-area-pb">
        {mobileNavItems.map((item) => {
          const isMore = item.label === 'More';
          const isActive = !isMore && (
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          );

          if (isMore) {
            return (
              <button
                key="more"
                onClick={() => setMobileMenuOpen(true)}
                className="flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[56px] text-warm-gray"
              >
                <span className="text-xl">⚙️</span>
                <span className="text-[10px] font-medium">More</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[56px] ${
                isActive ? 'text-amber' : 'text-warm-gray'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
