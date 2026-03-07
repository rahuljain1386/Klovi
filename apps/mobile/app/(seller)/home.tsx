import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { getCurrentSeller, getTodayOrders, getFlaggedConversations, getCoachSuggestions } from '@/lib/api';
import Button from '@/components/Button';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function HomeScreen() {
  const [seller, setSeller] = useState<any>(null);
  const [todayOrders, setTodayOrders] = useState<any[]>([]);
  const [flagged, setFlagged] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const s = await getCurrentSeller();
    setSeller(s);
    if (s) {
      const [o, f, c] = await Promise.all([getTodayOrders(s.id), getFlaggedConversations(s.id), getCoachSuggestions(s.id)]);
      setTodayOrders(o); setFlagged(f); setSuggestions(c);
    }
  };
  useEffect(() => { load(); }, []);

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const ready = todayOrders.filter(o => o.status === 'confirmed' || o.status === 'preparing');
  const rev = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
  const sym = seller?.country === 'india' ? '\u20B9' : '$';

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView contentContainerStyle={st.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.amber.DEFAULT} />}>
        <Text style={st.greeting}>{greeting}, {seller?.business_name?.split(' ')[0] || 'there'}!</Text>

        <View style={st.card}>
          <Text style={{ fontSize: 24, marginBottom: spacing.sm }}>{'\u{1F4E6}'}</Text>
          <Text style={st.cardTitle}>{todayOrders.length > 0 ? `${todayOrders.length} order${todayOrders.length > 1 ? 's' : ''} to prepare today` : 'No orders today yet'}</Text>
          {todayOrders.length > 0 && <TouchableOpacity onPress={() => router.push('/(seller)/orders')}><Text style={st.cardLink}>{`View all \u2192`}</Text></TouchableOpacity>}
        </View>

        {flagged.length > 0 && (
          <TouchableOpacity style={[st.card, { borderColor: colors.amber.DEFAULT, borderWidth: 1.5 }]} onPress={() => router.push('/(seller)/inbox')} activeOpacity={0.8}>
            <Text style={{ fontSize: 24, marginBottom: spacing.sm }}>{'\u{1F4AC}'}</Text>
            <Text style={st.cardTitle}>{flagged.length} message{flagged.length > 1 ? 's' : ''} need{flagged.length === 1 ? 's' : ''} your reply</Text>
            <Text style={st.cardLink}>{`Tap to reply \u2192`}</Text>
          </TouchableOpacity>
        )}

        {ready.length > 0 && <Button title={`Mark ${ready.length} Order${ready.length > 1 ? 's' : ''} Ready`} onPress={() => router.push('/(seller)/orders')} style={{ marginVertical: spacing.md }} />}

        {suggestions.length > 0 && (
          <View style={st.coach}>
            <Text style={st.coachBadge}>AI SUGGESTION</Text>
            <Text style={st.coachTitle}>{suggestions[0].title}</Text>
            <Text style={st.coachDesc}>{suggestions[0].description}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity style={st.coachYes}><Text style={{ fontWeight: '600', fontSize: 13, color: '#fff' }}>{suggestions[0].action_label || 'Yes'}</Text></TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 16 }}><Text style={{ fontSize: 13, color: colors.warmGray }}>Skip</Text></TouchableOpacity>
            </View>
          </View>
        )}

        {rev > 0 && <Text style={st.revenue}>{sym}{rev.toLocaleString()} received today</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  greeting: { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: spacing.lg },
  card: { backgroundColor: '#fff', borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardTitle: { fontWeight: '600', fontSize: 16, color: colors.ink, marginBottom: 4 },
  cardLink: { fontSize: 13, color: colors.amber.dark, fontWeight: '500' },
  coach: { backgroundColor: colors.purple.light, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1.5, borderColor: colors.purple.DEFAULT, marginBottom: spacing.md },
  coachBadge: { fontWeight: '700', fontSize: 10, color: colors.purple.DEFAULT, letterSpacing: 1, marginBottom: spacing.sm },
  coachTitle: { fontWeight: '600', fontSize: 15, color: colors.ink, marginBottom: 4 },
  coachDesc: { fontSize: 13, color: colors.warmGray, marginBottom: spacing.md },
  coachYes: { backgroundColor: colors.purple.DEFAULT, paddingVertical: 10, paddingHorizontal: 20, borderRadius: borderRadius.full },
  revenue: { fontSize: 13, color: colors.warmGray, textAlign: 'center', marginTop: spacing.md },
});
