import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function ConnectPaymentsScreen() {
  const go = () => router.push('/(auth)/onboarding/live');
  return (
    <SafeAreaView style={s.safe}><View style={s.container}>
      <Text style={s.step}>Step 7 of 7</Text>
      <Text style={s.question}>Connect your payment</Text>
      <Text style={s.hint}>So you can collect deposits and payments from customers</Text>
      <View style={{ gap: spacing.md }}>
        <TouchableOpacity style={s.option} onPress={go} activeOpacity={0.8}>
          <Text style={{ fontSize: 32 }}>{'\u{1F1EE}\u{1F1F3}'}</Text>
          <View><Text style={s.optTitle}>UPI / Razorpay</Text><Text style={s.optHint}>For India - UPI, cards, net banking</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={s.option} onPress={go} activeOpacity={0.8}>
          <Text style={{ fontSize: 32 }}>{'\u{1F1FA}\u{1F1F8}'}</Text>
          <View><Text style={s.optTitle}>Stripe</Text><Text style={s.optHint}>For USA - cards, Apple Pay, Google Pay</Text></View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={go} style={{ alignItems: 'center', marginTop: spacing.xl }}><Text style={{ fontSize: 14, color: colors.warmGray }}>I'll do this later</Text></TouchableOpacity>
    </View></SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  step: { fontSize: 13, color: colors.warmGray, marginBottom: spacing.sm, fontWeight: '500' },
  question: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  hint: { fontSize: 14, color: colors.warmGray, marginBottom: spacing.xl },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.xl, padding: spacing.lg, minHeight: 72 },
  optTitle: { fontWeight: '600', fontSize: 17, color: colors.ink },
  optHint: { fontSize: 13, color: colors.warmGray, marginTop: 2 },
});
