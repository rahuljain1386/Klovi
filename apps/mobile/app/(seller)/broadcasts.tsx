import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';

type Broadcast = {
  id: string;
  title: string;
  message: string;
  segments: string[];
  channels: string[];
  status: string;
  total_recipients: number;
  delivered: number;
  sent_at: string | null;
  created_at: string;
};

export default function BroadcastsScreen() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>(['all']);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['whatsapp']);

  const loadBroadcasts = async () => {
    const res = await api.get('/api/broadcasts');
    if (res.broadcasts) setBroadcasts(res.broadcasts);
  };

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBroadcasts();
    setRefreshing(false);
  };

  const createAndSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing fields', 'Please add a title and message');
      return;
    }

    const res = await api.post('/api/broadcasts', {
      title,
      message,
      segments: selectedSegments,
      channels: selectedChannels,
    });

    if (res.error) {
      Alert.alert('Error', res.error);
      return;
    }

    // Now send it
    if (res.broadcast) {
      Alert.alert('Send now?', `This will message ${res.broadcast.total_recipients} customers`, [
        { text: 'Save as Draft', style: 'cancel', onPress: () => { loadBroadcasts(); setShowCompose(false); } },
        {
          text: 'Send Now',
          onPress: async () => {
            await api.post(`/api/broadcasts/${res.broadcast.id}/send`, {});
            loadBroadcasts();
            setShowCompose(false);
            setTitle('');
            setMessage('');
          },
        },
      ]);
    }
  };

  const toggleSegment = (s: string) => {
    setSelectedSegments((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const toggleChannel = (c: string) => {
    setSelectedChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  if (showCompose) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.composeScroll}>
        <View style={styles.composeHeader}>
          <TouchableOpacity onPress={() => setShowCompose(false)}>
            <Ionicons name="close" size={28} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.composeTitle}>New Broadcast</Text>
          <View style={{ width: 28 }} />
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Weekend Special"
          placeholderTextColor={colors.warmGray}
        />

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder="Write your message..."
          placeholderTextColor={colors.warmGray}
          multiline
        />

        <Text style={styles.label}>Audience</Text>
        <View style={styles.chipRow}>
          {['all', 'loyal', 'active', 'dormant', 'new'].map((seg) => (
            <TouchableOpacity
              key={seg}
              style={[styles.chip, selectedSegments.includes(seg) && styles.chipActive]}
              onPress={() => toggleSegment(seg)}
            >
              <Text style={[styles.chipText, selectedSegments.includes(seg) && styles.chipTextActive]}>
                {seg.charAt(0).toUpperCase() + seg.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Channels</Text>
        <View style={styles.chipRow}>
          {['whatsapp', 'sms', 'instagram'].map((ch) => (
            <TouchableOpacity
              key={ch}
              style={[styles.chip, selectedChannels.includes(ch) && styles.chipActive]}
              onPress={() => toggleChannel(ch)}
            >
              <Text style={[styles.chipText, selectedChannels.includes(ch) && styles.chipTextActive]}>
                {ch === 'whatsapp' ? 'WhatsApp' : ch === 'sms' ? 'SMS' : 'Instagram'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.sendBtn} onPress={createAndSend}>
          <Ionicons name="send" size={20} color={colors.white} />
          <Text style={styles.sendBtnText}>Create & Send</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Broadcasts</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowCompose(true)}>
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber.DEFAULT} />}
      >
        {broadcasts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={48} color={colors.warmGray} />
            <Text style={styles.emptyTitle}>No broadcasts yet</Text>
            <Text style={styles.emptySubtitle}>Send promotions directly to your customers</Text>
          </View>
        ) : (
          broadcasts.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{b.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: b.status === 'sent' ? colors.green.light : colors.amber.light }]}>
                  <Text style={[styles.statusText, { color: b.status === 'sent' ? colors.green.DEFAULT : colors.amber.dark }]}>
                    {b.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMessage} numberOfLines={2}>{b.message}</Text>
              <View style={styles.cardStats}>
                <Text style={styles.stat}>{b.total_recipients} recipients</Text>
                {b.delivered > 0 && <Text style={styles.stat}>{b.delivered} delivered</Text>}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: spacing.lg, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontFamily: fonts.displayBold, color: colors.ink },
  newBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.amber.DEFAULT, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, gap: 4 },
  newBtnText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.white },
  list: { padding: spacing.lg, paddingTop: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontFamily: fonts.semibold, color: colors.ink, flex: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  statusText: { fontSize: 12, fontFamily: fonts.semibold },
  cardMessage: { fontSize: 14, fontFamily: fonts.regular, color: colors.warmGray, marginTop: spacing.sm },
  cardStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  stat: { fontSize: 13, fontFamily: fonts.medium, color: colors.warmGray },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 20, fontFamily: fonts.semibold, color: colors.ink, marginTop: spacing.md },
  emptySubtitle: { fontSize: 16, fontFamily: fonts.regular, color: colors.warmGray, marginTop: spacing.xs, textAlign: 'center' },
  // Compose
  composeScroll: { padding: spacing.lg, paddingTop: 60 },
  composeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  composeTitle: { fontSize: 20, fontFamily: fonts.semibold, color: colors.ink },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 16, fontFamily: fonts.regular, color: colors.ink },
  textArea: { height: 120, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 14, fontFamily: fonts.medium, color: colors.warmGray },
  chipTextActive: { color: colors.white },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.amber.DEFAULT, paddingVertical: spacing.md, borderRadius: borderRadius.lg, marginTop: spacing.xl, gap: spacing.sm },
  sendBtnText: { fontSize: 18, fontFamily: fonts.semibold, color: colors.white },
});
