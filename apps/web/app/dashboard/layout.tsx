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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sellerName, setSellerName] = useState('');
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
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#e7e0d4] flex flex-col fixed h-full">
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

      {/* Main content */}
      <main className="flex-1 ml-64">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
