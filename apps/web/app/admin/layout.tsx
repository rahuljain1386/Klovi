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
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="text-white/60 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#161822] border-r border-white/10 flex flex-col fixed h-full">
        <div className="p-5 border-b border-white/10">
          <div className="font-display text-xl text-white">KLOVI</div>
          <div className="text-[11px] text-amber font-semibold tracking-widest mt-0.5">ADMIN</div>
          <p className="text-[11px] text-white/40 mt-2 truncate">{email}</p>
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
                    ? 'bg-white/10 text-white border-r-2 border-amber'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <Link href="/dashboard" className="text-xs text-white/40 hover:text-white/70">
            Seller Dashboard →
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-56">
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
