import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl } from 'react-native';
import { getCurrentSeller, getConversations } from '@/lib/api';
import { colors, spacing, borderRadius } from '@/constants/theme';

const CH: Record<string, string> = { whatsapp: '\u{1F4AC}', instagram: '\u{1F4F8}', facebook: '\u{1F4D8}', sms: '\u{1F4F1}', web: '\u{1F310}' };

export default function InboxScreen() {
  const [convos, setConvos] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => { const s = await getCurrentSeller(); if (s) setConvos(await getConversations(s.id)); };
  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>Inbox</Text><Text style={s.sub}>All channels in one place</Text></View>
      <FlatList data={convos} keyExtractor={i => i.id} contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.amber.DEFAULT} />}
        renderItem={({ item }) => {
          const last = item.messages?.[0];
          return (
            <TouchableOpacity style={[s.convo, item.needs_seller_attention && { borderColor: colors.amber.DEFAULT, borderWidth: 1.5 }]} activeOpacity={0.7}>
              <View style={{ alignItems: 'center', position: 'relative' }}>
                <Text style={{ fontSize: 24 }}>{CH[item.channel] || '\u{1F4AC}'}</Text>
                {item.needs_seller_attention && <View style={s.dot} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={s.name}>{item.customers?.name || 'Unknown'}</Text>
                  <Text style={s.time}>{last ? new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                </View>
                <Text style={s.preview} numberOfLines={1}>{last?.sender === 'ai' ? '\u{1F916} ' : ''}{last?.content || 'No messages'}</Text>
                {item.needs_seller_attention && <Text style={s.flag}>Needs your reply</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Text style={{ fontSize: 40, marginBottom: spacing.md }}>{'\u{1F4E5}'}</Text>
            <Text style={{ fontWeight: '600', fontSize: 16, color: colors.ink, marginBottom: 4 }}>No messages yet</Text>
            <Text style={{ fontSize: 13, color: colors.warmGray, textAlign: 'center', maxWidth: 260 }}>Customer messages from WhatsApp, Instagram, and Facebook will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 13, color: colors.warmGray, marginTop: 2 },
  convo: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rose.DEFAULT, position: 'absolute', top: -2, right: -2 },
  name: { fontWeight: '600', fontSize: 14, color: colors.ink },
  time: { fontSize: 11, color: colors.warmGray },
  preview: { fontSize: 13, color: colors.warmGray },
  flag: { fontWeight: '600', fontSize: 11, color: colors.amber.dark, marginTop: 4 },
});
