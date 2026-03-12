'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const OWNER_EMAILS = ['meetrj1386@gmail.com', 'shefalijain@gmail.com'];

const navItems = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/catalog', label: 'Catalog', icon: '📦' },
  { href: '/admin/sellers', label: 'Sellers', icon: '🏪' },
  { href: '/admin/unrouted', label: 'Unrouted', icon: '⚠️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !OWNER_EMAILS.includes(user.email || '')) {
        router.push('/');
        return;
      }
      setEmail(user.email || '');
      setLoading(false);
    };
    check();
  }, [router]);

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
      <aside className="w-56 bg-white border-r border-border flex flex-col fixed h-full shrink-0 z-30">
        <div className="p-5 border-b border-border">
          <div className="font-display text-xl text-ink">KLOVI</div>
          <div className="text-[11px] text-amber font-semibold tracking-widest mt-0.5">ADMIN</div>
          <p className="text-[11px] text-warm-gray mt-2 truncate">{email}</p>
        </div>

        <nav className="flex-1 py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-amber/10 text-ink border-r-2 border-amber font-medium'
                    : 'text-warm-gray hover:text-ink hover:bg-cream/50'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <Link href="/dashboard" className="text-xs text-warm-gray hover:text-ink">
            Seller Dashboard →
          </Link>
        </div>
      </aside>

      {/* Main — min-w prevents collapse on scroll */}
      <main className="flex-1 ml-56 min-w-0 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
