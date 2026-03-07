import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../constants/theme';
import { api } from '../../lib/api';

type Suggestion = {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  action_type: string | null;
  status: string;
  created_at: string;
};

const typeConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  growth: { icon: 'trending-up', color: colors.green.DEFAULT },
  retention: { icon: 'people', color: colors.blue.DEFAULT },
  pricing: { icon: 'pricetag', color: colors.amber.DEFAULT },
  product: { icon: 'cube', color: colors.purple.DEFAULT },
  marketing: { icon: 'megaphone', color: colors.rose.DEFAULT },
};

export default function CoachScreen() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadSuggestions = async () => {
    const res = await api.get('/api/ai/coach');
    if (res.suggestions) setSuggestions(res.suggestions);
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSuggestions();
    setRefreshing(false);
  };

  const generateNew = async () => {
    setGenerating(true);
    const res = await api.post('/api/ai/coach', {});
    if (res.suggestion) {
      setSuggestions((prev) => [res.suggestion, ...prev]);
    }
    setGenerating(false);
  };

  const priorityColor = (p: string) => {
    if (p === 'high') return colors.rose.DEFAULT;
    if (p === 'medium') return colors.amber.DEFAULT;
    return colors.teal.DEFAULT;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Coach</Text>
          <Text style={styles.subtitle}>Personalized tips for your business</Text>
        </View>
        <TouchableOpacity style={styles.generateBtn} onPress={generateNew} disabled={generating}>
          {generating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={colors.white} />
              <Text style={styles.generateBtnText}>New Tip</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber.DEFAULT} />
        }
      >
        {suggestions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bulb-outline" size={48} color={colors.warmGray} />
            <Text style={styles.emptyTitle}>No tips yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "New Tip" to get your first AI-powered business insight
            </Text>
          </View>
        ) : (
          suggestions.map((s) => {
            const config = typeConfig[s.type] || { icon: 'bulb' as const, color: colors.warmGray };
            return (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: config.color + '15' }]}>
                    <Ionicons name={config.icon} size={22} color={config.color} />
                  </View>
                  <View style={styles.badges}>
                    <View style={[styles.badge, { backgroundColor: priorityColor(s.priority) + '15' }]}>
                      <Text style={[styles.badgeText, { color: priorityColor(s.priority) }]}>
                        {s.priority}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: config.color + '15' }]}>
                      <Text style={[styles.badgeText, { color: config.color }]}>{s.type}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.cardTitle}>{s.title}</Text>
                <Text style={styles.cardDesc}>{s.description}</Text>
                {s.action_type && s.status === 'pending' && (
                  <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>
                      {s.action_type === 'broadcast' ? 'Send Broadcast' :
                       s.action_type === 'price_change' ? 'Adjust Prices' :
                       s.action_type === 'restock' ? 'Update Stock' :
                       'Take Action'}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.amber.DEFAULT} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: spacing.lg, paddingTop: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 28, fontFamily: fonts.displayBold, color: colors.ink },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, color: colors.warmGray, marginTop: 2 },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.purple.DEFAULT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  generateBtnText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.white },
  list: { padding: spacing.lg, paddingTop: spacing.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  iconWrap: { width: 40, height: 40, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: spacing.xs },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  badgeText: { fontSize: 11, fontFamily: fonts.semibold, textTransform: 'capitalize' },
  cardTitle: { fontSize: 17, fontFamily: fonts.semibold, color: colors.ink, marginBottom: 4 },
  cardDesc: { fontSize: 15, fontFamily: fonts.regular, color: colors.warmGray, lineHeight: 22 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.amber.light,
  },
  actionBtnText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.amber.DEFAULT },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 20, fontFamily: fonts.semibold, color: colors.ink, marginTop: spacing.md },
  emptySubtitle: { fontSize: 16, fontFamily: fonts.regular, color: colors.warmGray, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.xl },
});
