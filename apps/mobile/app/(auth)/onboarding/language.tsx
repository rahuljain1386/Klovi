import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function LanguageScreen() {
  const select = (code: string) => { router.push('/(auth)/onboarding/business-name'); };
  return (
    <SafeAreaView style={s.safe}><View style={s.container}>
      <Text style={s.step}>Step 1 of 7</Text>
      <Text style={s.question}>What language do you prefer?</Text>
      <View style={{ gap: spacing.md }}>
        {[{ code: 'en', label: 'English', flag: '\u{1F1FA}\u{1F1F8}' }, { code: 'hi', label: '\u0939\u093F\u0928\u094D\u0926\u0940', flag: '\u{1F1EE}\u{1F1F3}' }, { code: 'es', label: 'Espa\u00F1ol', flag: '\u{1F1EA}\u{1F1F8}' }].map((l) => (
          <TouchableOpacity key={l.code} style={s.option} onPress={() => select(l.code)} activeOpacity={0.8}>
            <Text style={{ fontSize: 36 }}>{l.flag}</Text>
            <Text style={s.optionText}>{l.label}</Text>
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
  optionText: { fontWeight: '600', fontSize: 20, color: colors.ink },
});
