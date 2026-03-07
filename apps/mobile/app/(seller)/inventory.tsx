import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl } from 'react-native';
import { getCurrentSeller, getSellerProducts, updateProductStock } from '@/lib/api';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function InventoryScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => { const s = await getCurrentSeller(); if (s) setProducts(await getSellerProducts(s.id)); };
  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>Inventory</Text><Text style={s.sub}>How many did you make today?</Text></View>
      <FlatList data={products} keyExtractor={i => i.id} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.amber.DEFAULT} />}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.price}>{item.currency === 'INR' ? '\u20B9' : '$'}{item.price}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Text style={s.stockLabel}>Stock:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <TouchableOpacity style={s.btn} onPress={async () => { await updateProductStock(item.id, Math.max(0, (item.stock_quantity || 0) - 1)); load(); }}>
                  <Text style={s.btnText}>-</Text>
                </TouchableOpacity>
                <Text style={[s.count, item.stock_quantity === 0 && { color: colors.rose.DEFAULT }]}>{item.stock_quantity !== null ? item.stock_quantity : '\u221E'}</Text>
                <TouchableOpacity style={s.btn} onPress={async () => { await updateProductStock(item.id, (item.stock_quantity || 0) + 1); load(); }}>
                  <Text style={s.btnText}>+</Text>
                </TouchableOpacity>
              </View>
              {item.status === 'sold_out' ? (
                <TouchableOpacity style={s.restock} onPress={async () => { await updateProductStock(item.id, 10); load(); }}><Text style={s.restockText}>Restock</Text></TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.soldOut} onPress={async () => { await updateProductStock(item.id, 0); load(); }}><Text style={s.soldOutText}>Sold Out</Text></TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<View style={{ alignItems: 'center', paddingTop: 60 }}><Text style={{ color: colors.warmGray }}>No products yet</Text></View>}
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13, color: colors.warmGray, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  name: { fontWeight: '600', fontSize: 15, color: colors.ink, flex: 1 },
  price: { fontWeight: '700', fontSize: 15, color: colors.amber.dark },
  stockLabel: { fontSize: 13, color: colors.warmGray, fontWeight: '500' },
  btn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.amber.light, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700', fontSize: 18, color: colors.amber.dark },
  count: { fontWeight: '700', fontSize: 18, color: colors.ink, minWidth: 30, textAlign: 'center' },
  restock: { marginLeft: 'auto', backgroundColor: colors.green.DEFAULT, paddingVertical: 8, paddingHorizontal: 16, borderRadius: borderRadius.full },
  restockText: { fontWeight: '600', fontSize: 12, color: '#fff' },
  soldOut: { marginLeft: 'auto', backgroundColor: colors.rose.light, paddingVertical: 8, paddingHorizontal: 16, borderRadius: borderRadius.full },
  soldOutText: { fontWeight: '600', fontSize: 12, color: colors.rose.DEFAULT },
});
