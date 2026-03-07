import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl } from 'react-native';
import { getCurrentSeller, getAllOrders, markOrderReady, markOrderCollected } from '@/lib/api';
import { colors, spacing, borderRadius } from '@/constants/theme';

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  pending_deposit: { label: 'Awaiting Deposit', bg: colors.amber.light, text: colors.amber.dark },
  deposit_paid: { label: 'Deposit Paid', bg: colors.blue.light, text: colors.blue.DEFAULT },
  confirmed: { label: 'Confirmed', bg: colors.blue.light, text: colors.blue.DEFAULT },
  preparing: { label: 'Preparing', bg: colors.purple.light, text: colors.purple.DEFAULT },
  ready: { label: 'Ready', bg: colors.green.light, text: colors.green.DEFAULT },
  completed: { label: 'Completed', bg: colors.green.light, text: colors.green.DEFAULT },
  cancelled: { label: 'Cancelled', bg: colors.rose.light, text: colors.rose.DEFAULT },
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => { const s = await getCurrentSeller(); if (s) setOrders(await getAllOrders(s.id)); };
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().split('T')[0];
  const filtered = orders.filter(o => {
    if (filter === 'today') return o.pickup_date === today;
    if (filter === 'upcoming') return o.pickup_date > today && !['completed', 'cancelled'].includes(o.status);
    if (filter === 'done') return o.status === 'completed';
    return true;
  });

  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.title}>Orders</Text>
      <View style={s.filters}>
        {['today', 'upcoming', 'done', 'all'].map(f => (
          <TouchableOpacity key={f} style={[s.tab, filter === f && s.tabActive]} onPress={() => setFilter(f)}>
            <Text style={[s.tabText, filter === f && s.tabTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList data={filtered} keyExtractor={i => i.id} contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.amber.DEFAULT} />}
        renderItem={({ item }) => {
          const st = STATUS[item.status] || { label: item.status, bg: '#f3f4f6', text: '#6b7280' };
          const sym = item.currency === 'INR' ? '\u20B9' : '$';
          return (
            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <View><Text style={s.orderNum}>{item.order_number}</Text><Text style={s.name}>{item.customers?.name}</Text></View>
                <View style={[s.badge, { backgroundColor: st.bg }]}><Text style={[s.badgeText, { color: st.text }]}>{st.label}</Text></View>
              </View>
              <Text style={s.items}>{item.items?.map((i: any) => `${i.quantity}x ${i.product_name}`).join(', ')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={s.total}>{sym}{item.total}</Text>
                {item.pickup_date && <Text style={s.date}>{item.pickup_date}</Text>}
                {item.is_cod && <View style={[s.badge, { backgroundColor: colors.amber.light }]}><Text style={[s.badgeText, { color: colors.amber.dark }]}>COD</Text></View>}
              </View>
              {['confirmed', 'preparing'].includes(item.status) && (
                <TouchableOpacity style={s.action} onPress={async () => { await markOrderReady(item.id); load(); }}><Text style={s.actionText}>Mark Ready</Text></TouchableOpacity>
              )}
              {item.status === 'ready' && (
                <TouchableOpacity style={[s.action, { backgroundColor: colors.green.DEFAULT }]} onPress={async () => { await markOrderCollected(item.id); load(); }}><Text style={s.actionText}>Mark Collected</Text></TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<View style={{ alignItems: 'center', paddingTop: 60 }}><Text style={{ color: colors.warmGray }}>No orders here yet</Text></View>}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, padding: spacing.lg, paddingBottom: spacing.sm },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontSize: 13, color: colors.warmGray, fontWeight: '500' },
  tabTextActive: { color: colors.amber.DEFAULT },
  card: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  orderNum: { fontSize: 12, color: colors.warmGray },
  name: { fontWeight: '600', fontSize: 15, color: colors.ink, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  badgeText: { fontWeight: '600', fontSize: 11 },
  items: { fontSize: 13, color: colors.warmGray, marginBottom: spacing.sm },
  total: { fontWeight: '700', fontSize: 15, color: colors.ink },
  date: { fontSize: 12, color: colors.warmGray },
  action: { backgroundColor: colors.amber.DEFAULT, paddingVertical: 14, borderRadius: borderRadius.lg, alignItems: 'center', marginTop: spacing.md },
  actionText: { fontWeight: '600', fontSize: 15, color: '#fff' },
});
