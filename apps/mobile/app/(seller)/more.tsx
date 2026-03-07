import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function MoreScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={s.title}>More</Text>
        <View style={{ gap: 4 }}>
          {[
            { label: 'Customers', icon: '\u{1F465}' }, { label: 'Reviews', icon: '\u2B50' },
            { label: 'Marketing', icon: '\u{1F4E3}' }, { label: 'Analytics', icon: '\u{1F4CA}' },
            { label: 'My Booking Page', icon: '\u{1F517}' }, { label: 'Settings', icon: '\u2699\uFE0F' },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={s.menuItem} activeOpacity={0.7}>
              <Text style={{ fontSize: 22 }}>{item.icon}</Text>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={{ fontSize: 16, color: colors.warmGray }}>{'\u2192'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.logout} onPress={() => Alert.alert('Log out', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log out', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); router.replace('/'); } },
        ])}>
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
        <Text style={s.version}>Klovi v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: spacing.lg },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  menuLabel: { fontWeight: '500', fontSize: 15, color: colors.ink, flex: 1 },
  logout: { marginTop: spacing.xl, padding: spacing.md, alignItems: 'center', backgroundColor: colors.rose.light, borderRadius: borderRadius.lg },
  logoutText: { fontWeight: '600', fontSize: 14, color: colors.rose.DEFAULT },
  version: { fontSize: 12, color: colors.warmGray, textAlign: 'center', marginTop: spacing.lg },
});
