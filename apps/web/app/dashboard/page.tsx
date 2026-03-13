'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type ShopStatus = {
  sellerName: string;
  slug: string;
  productCount: number;
  availableCount: number;
  pendingOrders: number;
  unreadMessages: number;
  totalCustomers: number;
  todayOrders: number;
  todayRevenue: number;
  currency: string;
  hasWhatsApp: boolean;
  hasDelivery: boolean;
};

export default function DashboardHome() {
  const [shop, setShop] = useState<ShopStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadShopStatus();
  }, []);

  const loadShopStatus = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: seller } = await supabase
      .from('sellers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!seller) return;

    // Parallel queries
    const [productsRes, pendingRes, unreadRes, todayOrdersRes] = await Promise.all([
      supabase.from('products').select('id, is_available', { count: 'exact' }).eq('seller_id', seller.id),
      supabase.from('orders').select('id', { count: 'exact' }).eq('seller_id', seller.id).in('status', ['placed', 'confirmed']),
      supabase.from('conversations').select('id', { count: 'exact' }).eq('seller_id', seller.id).gt('unread_count', 0),
      supabase.from('orders').select('total').eq('seller_id', seller.id).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ]);

    const products = productsRes.data || [];
    setShop({
      sellerName: seller.business_name,
      slug: seller.slug,
      productCount: productsRes.count || 0,
      availableCount: products.filter(p => p.is_available).length,
      pendingOrders: pendingRes.count || 0,
      unreadMessages: unreadRes.count || 0,
      totalCustomers: seller.total_customers || 0,
      todayOrders: todayOrdersRes.data?.length || 0,
      todayRevenue: todayOrdersRes.data?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0,
      currency: seller.country === 'india' ? 'INR' : 'USD',
      hasWhatsApp: !!(seller.whatsapp_number || seller.phone),
      hasDelivery: !!seller.fulfillment_type,
    });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const copyShopLink = () => {
    if (!shop?.slug) return;
    navigator.clipboard.writeText(`https://kloviapp.com/${shop.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!shop) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-warm-gray">Loading...</div>
      </div>
    );
  }

  const currencySymbol = shop.currency === 'INR' ? '\u20B9' : '$';
  const isNewSeller = shop.todayOrders === 0 && shop.totalCustomers === 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-warm-gray text-sm">{greeting()},</p>
        <h1 className="font-display text-2xl md:text-3xl text-ink">{shop.sellerName}</h1>
      </div>

      {/* Shop link card — always visible, prominent */}
      <div className="bg-white rounded-xl p-4 md:p-5 border border-[#e7e0d4] mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-warm-gray">Your shop link</p>
          <p className="text-sm font-medium text-amber truncate">kloviapp.com/{shop.slug}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={copyShopLink}
            className="px-4 py-2 bg-amber text-white text-sm font-semibold rounded-lg hover:bg-amber/90 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Check out my shop: https://kloviapp.com/${shop.slug}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green text-white text-sm font-semibold rounded-lg hover:bg-green/90 transition-colors"
          >
            Share
          </a>
        </div>
      </div>

      {/* Shop snapshot — what matters */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/dashboard/products" className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors">
          <p className="text-2xl font-bold text-ink">{shop.productCount}</p>
          <p className="text-sm text-warm-gray">Products</p>
          <p className="text-xs text-green mt-1">{shop.availableCount} available</p>
        </Link>
        <Link href="/dashboard/orders" className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors">
          <p className="text-2xl font-bold text-ink">{shop.todayOrders}</p>
          <p className="text-sm text-warm-gray">Today&apos;s Orders</p>
          {shop.todayRevenue > 0 && (
            <p className="text-xs text-green mt-1">{currencySymbol}{shop.todayRevenue.toFixed(0)} earned</p>
          )}
        </Link>
        <Link href="/dashboard/inbox" className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors">
          <p className="text-2xl font-bold text-ink">{shop.unreadMessages}</p>
          <p className="text-sm text-warm-gray">Unread Messages</p>
          {shop.unreadMessages > 0 && (
            <p className="text-xs text-amber mt-1">Needs reply</p>
          )}
        </Link>
        <Link href="/dashboard/customers" className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors">
          <p className="text-2xl font-bold text-ink">{shop.totalCustomers}</p>
          <p className="text-sm text-warm-gray">Customers</p>
        </Link>
      </div>

      {/* Action items — things that need attention */}
      {(shop.pendingOrders > 0 || shop.unreadMessages > 0) && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-3">Needs your attention</h2>
          <div className="space-y-2">
            {shop.pendingOrders > 0 && (
              <Link href="/dashboard/orders" className="flex items-center justify-between bg-amber/5 rounded-xl p-4 border border-amber/20 group">
                <div>
                  <p className="font-semibold text-ink">{shop.pendingOrders} order{shop.pendingOrders > 1 ? 's' : ''} pending</p>
                  <p className="text-sm text-warm-gray">Review and confirm</p>
                </div>
                <span className="text-amber group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
            )}
            {shop.unreadMessages > 0 && (
              <Link href="/dashboard/inbox" className="flex items-center justify-between bg-blue/5 rounded-xl p-4 border border-blue/20 group">
                <div>
                  <p className="font-semibold text-ink">{shop.unreadMessages} unread message{shop.unreadMessages > 1 ? 's' : ''}</p>
                  <p className="text-sm text-warm-gray">Reply to keep customers happy</p>
                </div>
                <span className="text-blue group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Setup checklist for new sellers */}
      {isNewSeller && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-3">Get your shop ready</h2>
          <div className="bg-white rounded-xl border border-[#e7e0d4] divide-y divide-[#e7e0d4]">
            <ChecklistItem
              done={shop.productCount > 0}
              label="Add your products"
              subtitle={shop.productCount > 0 ? `${shop.productCount} products added` : 'List what you sell with photos and prices'}
              href="/dashboard/products"
            />
            <ChecklistItem
              done={shop.hasWhatsApp}
              label="Connect WhatsApp"
              subtitle={shop.hasWhatsApp ? 'Connected' : 'So customers can message you'}
              href="/dashboard/settings"
            />
            <ChecklistItem
              done={shop.hasDelivery}
              label="Set delivery options"
              subtitle={shop.hasDelivery ? 'Configured' : 'Pickup, delivery, or both'}
              href="/dashboard/settings"
            />
            <ChecklistItem
              done={false}
              label="Share your shop link"
              subtitle="Send to friends, post on social media"
              onClick={copyShopLink}
            />
          </div>
        </div>
      )}

      {/* Quick actions */}
      <h2 className="text-lg font-semibold text-ink mb-3">Quick actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Add Product', href: '/dashboard/products', icon: '➕' },
          { label: 'Send Broadcast', href: '/dashboard/broadcasts', icon: '📢' },
          { label: 'Create Post', href: '/dashboard/posts', icon: '🎨' },
          { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors text-center"
          >
            <span className="text-xl">{action.icon}</span>
            <p className="text-sm font-medium text-ink mt-1">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ChecklistItem({ done, label, subtitle, href, onClick }: {
  done: boolean;
  label: string;
  subtitle: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex items-center gap-3 p-4 group">
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        done ? 'bg-green border-green text-white' : 'border-[#e7e0d4]'
      }`}>
        {done && <span className="text-xs">&#10003;</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${done ? 'text-warm-gray line-through' : 'text-ink'}`}>{label}</p>
        <p className="text-xs text-warm-gray">{subtitle}</p>
      </div>
      {!done && <span className="text-warm-gray group-hover:text-amber transition-colors">&rarr;</span>}
    </div>
  );

  if (onClick) {
    return <button onClick={onClick} className="w-full text-left hover:bg-cream/50 transition-colors">{content}</button>;
  }
  if (href) {
    return <Link href={href} className="block hover:bg-cream/50 transition-colors">{content}</Link>;
  }
  return <div>{content}</div>;
}
