import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function AddMenuScreen() {
  const go = () => router.push('/(auth)/onboarding/review-menu');
  return (
    <SafeAreaView style={s.safe}><View style={s.container}>
      <Text style={s.step}>Step 4 of 7</Text>
      <Text style={s.question}>Add your catalog</Text>
      <Text style={s.hint}>Pick the easiest way for you. AI will do the rest.</Text>
      <View style={{ gap: spacing.md }}>
        {[
          { icon: '\u{1F4F8}', title: 'Take a photo', hint: 'Photo of your menu, price list, or items' },
          { icon: '\u{1F3A4}', title: 'Speak it', hint: 'Just say what you sell and the prices' },
          { icon: '\u{1F4CB}', title: 'Paste text', hint: 'Paste from WhatsApp, Instagram, or notes' },
        ].map((o) => (
          <TouchableOpacity key={o.title} style={s.option} onPress={go} activeOpacity={0.8}>
            <Text style={{ fontSize: 32 }}>{o.icon}</Text>
            <View><Text style={s.optTitle}>{o.title}</Text><Text style={s.optHint}>{o.hint}</Text></View>
          </TouchableOpacity>
        ))}
      </View>
    </View></SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  step: { fontSize: 13, color: colors.warmGray, marginBottom: spacing.sm, fontWeight: '500' },
  question: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  hint: { fontSize: 14, color: colors.warmGray, marginBottom: spacing.xl },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.xl, padding: spacing.lg, minHeight: 80 },
  optTitle: { fontWeight: '600', fontSize: 17, color: colors.ink },
  optHint: { fontSize: 13, color: colors.warmGray, marginTop: 2 },
});
