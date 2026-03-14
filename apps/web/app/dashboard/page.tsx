'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { t } from '@/lib/i18n';

type ShopProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  images: string[] | null;
  is_available: boolean;
};

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
  hasPayment: boolean;
  language: string;
};

export default function DashboardHome() {
  const [shop, setShop] = useState<ShopStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [recentProducts, setRecentProducts] = useState<ShopProduct[]>([]);

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
    const [productsRes, pendingRes, unreadRes, todayOrdersRes, recentProdsRes] = await Promise.all([
      supabase.from('products').select('id, is_available', { count: 'exact' }).eq('seller_id', seller.id),
      supabase.from('orders').select('id', { count: 'exact' }).eq('seller_id', seller.id).in('status', ['placed', 'confirmed']),
      supabase.from('conversations').select('id', { count: 'exact' }).eq('seller_id', seller.id).gt('unread_count', 0),
      supabase.from('orders').select('total').eq('seller_id', seller.id).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from('products').select('id, name, price, currency, images, is_available').eq('seller_id', seller.id).order('sort_order').limit(6),
    ]);

    const products = productsRes.data || [];
    setRecentProducts((recentProdsRes.data as ShopProduct[]) || []);
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
      hasDelivery: !!(seller.fulfillment_modes?.length > 0),
      hasPayment: !!(seller.cod_enabled || seller.upi_id || seller.stripe_account_id),
      language: seller.language || 'en',
    });
  };

  const greeting = () => {
    const h = new Date().getHours();
    const lang = shop?.language || 'en';
    if (h < 12) return t('dash.morning', lang);
    if (h < 17) return t('dash.afternoon', lang);
    return t('dash.evening', lang);
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
          <p className="text-xs text-warm-gray">{t('dash.shopLink', shop.language)}</p>
          <p className="text-sm font-medium text-amber truncate">kloviapp.com/{shop.slug}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={copyShopLink}
            className="px-4 py-2 bg-amber text-white text-sm font-semibold rounded-lg hover:bg-amber/90 transition-colors"
          >
            {copied ? t('dash.copied', shop.language) : t('dash.copyLink', shop.language)}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Check out my shop: https://kloviapp.com/${shop.slug}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green text-white text-sm font-semibold rounded-lg hover:bg-green/90 transition-colors"
          >
            {t('live.share', shop.language)}
          </a>
        </div>
      </div>

      {/* Shop snapshot — what matters */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/dashboard/products" className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors">
          <p className="text-2xl font-bold text-ink">{shop.productCount}</p>
          <p className="text-sm text-warm-gray">{t('dash.products', shop.language)}</p>
          <p className="text-xs text-green mt-1">{shop.availableCount} {t('dash.available', shop.language)}</p>
        </Link>
        <Link href="/dashboard/orders" className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors">
          <p className="text-2xl font-bold text-ink">{shop.todayOrders}</p>
          <p className="text-sm text-warm-gray">{t('dash.todayOrders', shop.language)}</p>
          {shop.todayRevenue > 0 && (
            <p className="text-xs text-green mt-1">{currencySymbol}{shop.todayRevenue.toFixed(0)} {t('dash.earned', shop.language)}</p>
          )}
        </Link>
        <Link href="/dashboard/inbox" className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors">
          <p className="text-2xl font-bold text-ink">{shop.unreadMessages}</p>
          <p className="text-sm text-warm-gray">{t('dash.unread', shop.language)}</p>
          {shop.unreadMessages > 0 && (
            <p className="text-xs text-amber mt-1">{t('dash.needsReply', shop.language)}</p>
          )}
        </Link>
        <Link href="/dashboard/customers" className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors">
          <p className="text-2xl font-bold text-ink">{shop.totalCustomers}</p>
          <p className="text-sm text-warm-gray">{t('dash.customers', shop.language)}</p>
        </Link>
      </div>

      {/* Action items — things that need attention */}
      {(shop.pendingOrders > 0 || shop.unreadMessages > 0) && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-ink mb-3">{t('dash.attention', shop.language)}</h2>
          <div className="space-y-2">
            {shop.pendingOrders > 0 && (
              <Link href="/dashboard/orders" className="flex items-center justify-between bg-amber/5 rounded-xl p-4 border border-amber/20 group">
                <div>
                  <p className="font-semibold text-ink">{shop.pendingOrders} {t('dash.ordersPending', shop.language)}</p>
                  <p className="text-sm text-warm-gray">{t('dash.reviewConfirm', shop.language)}</p>
                </div>
                <span className="text-amber group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
            )}
            {shop.unreadMessages > 0 && (
              <Link href="/dashboard/inbox" className="flex items-center justify-between bg-blue/5 rounded-xl p-4 border border-blue/20 group">
                <div>
                  <p className="font-semibold text-ink">{shop.unreadMessages} {t('dash.unreadMsg', shop.language)}</p>
                  <p className="text-sm text-warm-gray">{t('dash.replyHappy', shop.language)}</p>
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
          <h2 className="text-lg font-semibold text-ink mb-3">{t('dash.getReady', shop.language)}</h2>
          <div className="bg-white rounded-xl border border-[#e7e0d4] divide-y divide-[#e7e0d4]">
            <ChecklistItem
              done={shop.productCount > 0}
              label={t('dash.addProducts', shop.language)}
              subtitle={shop.productCount > 0 ? `${shop.productCount} ${t('dash.productsAdded', shop.language)}` : t('dash.listSell', shop.language)}
              href="/dashboard/products"
            />
            <ChecklistItem
              done={shop.hasWhatsApp}
              label={t('dash.connectWA', shop.language)}
              subtitle={shop.hasWhatsApp ? t('dash.connected', shop.language) : t('dash.soCustomers', shop.language)}
              href="/dashboard/settings"
            />
            <ChecklistItem
              done={shop.hasDelivery}
              label={t('dash.setDelivery', shop.language)}
              subtitle={shop.hasDelivery ? t('dash.configured', shop.language) : t('dash.pickupDelivery', shop.language)}
              href="/dashboard/settings"
            />
            <ChecklistItem
              done={shop.hasPayment}
              label="Set up payment"
              subtitle={shop.hasPayment ? 'Payment configured' : 'Cash, UPI, or online payment'}
              href="/dashboard/settings"
            />
            <ChecklistItem
              done={false}
              label={t('dash.shareLink', shop.language)}
              subtitle={t('dash.shareSubtitle', shop.language)}
              onClick={copyShopLink}
            />
          </div>
        </div>
      )}

      {/* Your Products preview */}
      {recentProducts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-ink">{t('dash.products', shop.language)}</h2>
            <Link href="/dashboard/products" className="text-sm text-amber font-medium hover:underline">
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {recentProducts.map((product) => {
              const sym = product.currency === 'INR' ? '\u20B9' : '$';
              return (
                <Link key={product.id} href="/dashboard/products" className="bg-white rounded-xl border border-[#e7e0d4] overflow-hidden hover:border-amber transition-colors">
                  <div className="h-20 bg-cream flex items-center justify-center">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">📦</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-ink truncate">{product.name}</p>
                    {product.price > 0 && <p className="text-[10px] text-green">{sym}{product.price}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <h2 className="text-lg font-semibold text-ink mb-3">{t('dash.quickActions', shop.language)}</h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'dash.addProduct', href: '/dashboard/products', icon: '➕' },
          { key: 'dash.createPost', href: '/dashboard/posts', icon: '🎨' },
          { key: 'dash.broadcast', href: '/dashboard/broadcasts', icon: '📢' },
          { key: 'dash.customers', href: '/dashboard/customers', icon: '👥' },
          { key: 'dash.settings', href: '/dashboard/settings', icon: '⚙️' },
          { label: 'View Shop', href: '', icon: '👁️', isShopLink: true },
        ].map((action) => (
          action.isShopLink ? (
            <a
              key="shop-link"
              href={`https://kloviapp.com/${shop.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors text-center"
            >
              <span className="text-xl">{action.icon}</span>
              <p className="text-sm font-medium text-ink mt-1">{action.label}</p>
            </a>
          ) : (
            <Link
              key={action.key}
              href={action.href}
              className="bg-white rounded-xl p-4 border border-[#e7e0d4] hover:border-amber transition-colors text-center"
            >
              <span className="text-xl">{action.icon}</span>
              <p className="text-sm font-medium text-ink mt-1">{action.key ? t(action.key, shop.language) : ''}</p>
            </Link>
          )
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
