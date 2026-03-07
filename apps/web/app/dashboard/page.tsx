'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type Task = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  color: string;
};

export default function DashboardHome() {
  const [sellerName, setSellerName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({ todayOrders: 0, todayRevenue: 0, totalCustomers: 0, avgRating: 0 });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: seller } = await supabase
      .from('sellers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!seller) return;
    setSellerName(seller.business_name);

    const taskList: Task[] = [];

    // Pending orders
    const { count: pendingCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('seller_id', seller.id)
      .in('status', ['placed', 'confirmed']);

    if (pendingCount && pendingCount > 0) {
      taskList.push({
        id: 'orders',
        type: 'order',
        title: `${pendingCount} order${pendingCount > 1 ? 's' : ''} need attention`,
        subtitle: 'View and manage pending orders',
        href: '/dashboard/orders',
        color: 'amber',
      });
    }

    // Unread messages
    const { count: unreadCount } = await supabase
      .from('conversations')
      .select('id', { count: 'exact' })
      .eq('seller_id', seller.id)
      .gt('unread_count', 0);

    if (unreadCount && unreadCount > 0) {
      taskList.push({
        id: 'inbox',
        type: 'message',
        title: `${unreadCount} unread conversation${unreadCount > 1 ? 's' : ''}`,
        subtitle: 'Reply to keep customers happy',
        href: '/dashboard/inbox',
        color: 'blue',
      });
    }

    // Low stock
    const { count: lowStockCount } = await supabase
      .from('products')
      .select('id', { count: 'exact' })
      .eq('seller_id', seller.id)
      .eq('track_stock', true)
      .lt('stock_quantity', 5)
      .gt('stock_quantity', 0);

    if (lowStockCount && lowStockCount > 0) {
      taskList.push({
        id: 'stock',
        type: 'stock',
        title: `${lowStockCount} item${lowStockCount > 1 ? 's' : ''} running low`,
        subtitle: 'Update stock before they sell out',
        href: '/dashboard/products',
        color: 'rose',
      });
    }

    setTasks(taskList);

    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total')
      .eq('seller_id', seller.id)
      .gte('created_at', todayStart.toISOString());

    setStats({
      todayOrders: todayOrders?.length || 0,
      todayRevenue: todayOrders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
      totalCustomers: seller.total_customers || 0,
      avgRating: seller.avg_rating || 0,
    });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-warm-gray">{greeting()},</p>
        <h1 className="font-display text-3xl text-ink">{sellerName}</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Today's Orders", value: stats.todayOrders },
          { label: "Today's Revenue", value: `$${stats.todayRevenue.toFixed(0)}` },
          { label: 'Total Customers', value: stats.totalCustomers },
          { label: 'Avg Rating', value: stats.avgRating ? `${stats.avgRating.toFixed(1)} / 5` : 'N/A' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-5 border border-[#e7e0d4]">
            <p className="text-2xl font-bold text-ink">{stat.value}</p>
            <p className="text-sm text-warm-gray mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* To-do list */}
      <h2 className="text-xl font-semibold text-ink mb-4">Your to-do list</h2>
      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl p-8 border border-[#e7e0d4] text-center">
          <p className="text-3xl mb-2">&#10003;</p>
          <p className="text-lg font-semibold text-ink">All caught up!</p>
          <p className="text-warm-gray">No pending tasks right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={task.href}
              className="flex items-center justify-between bg-white rounded-xl p-5 border border-[#e7e0d4] hover:border-amber transition-colors group"
            >
              <div>
                <p className="font-semibold text-ink">{task.title}</p>
                <p className="text-sm text-warm-gray mt-1">{task.subtitle}</p>
              </div>
              <span className="text-warm-gray group-hover:text-amber transition-colors">&rarr;</span>
            </Link>
          ))}
        </div>
      )}

      {/* Quick links */}
      <h2 className="text-xl font-semibold text-ink mb-4 mt-8">Quick actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Add Product', href: '/dashboard/products', icon: '➕' },
          { label: 'Send Broadcast', href: '/dashboard/broadcasts', icon: '📢' },
          { label: 'Create Post', href: '/dashboard/posts', icon: '🎨' },
          { label: 'View Booking Page', href: '/dashboard/settings', icon: '🔗' },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="bg-white rounded-xl p-5 border border-[#e7e0d4] hover:border-amber transition-colors text-center"
          >
            <span className="text-2xl">{action.icon}</span>
            <p className="text-sm font-medium text-ink mt-2">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
