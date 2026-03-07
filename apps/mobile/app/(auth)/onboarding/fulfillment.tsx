import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function FulfillmentScreen() {
  const go = () => router.push('/(auth)/onboarding/connect-payments');
  return (
    <SafeAreaView style={s.safe}><View style={s.container}>
      <Text style={s.step}>Step 6 of 7</Text>
      <Text style={s.question}>Do customers come to you, or do you deliver?</Text>
      <View style={{ gap: spacing.md }}>
        {[
          { icon: '\u{1F3E0}', title: 'They come to me', hint: 'Customers pick up from your location' },
          { icon: '\u{1F697}', title: 'I deliver', hint: 'You drop off at their location' },
          { icon: '\u2705', title: 'Both', hint: 'Customers can choose' },
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
  question: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: spacing.xl },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.xl, padding: spacing.lg, minHeight: 72 },
  optTitle: { fontWeight: '600', fontSize: 17, color: colors.ink },
  optHint: { fontSize: 13, color: colors.warmGray, marginTop: 2 },
});
