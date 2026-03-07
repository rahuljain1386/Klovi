import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import Button from '@/components/Button';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function WhatYouSellScreen() {
  const [desc, setDesc] = useState('');
  return (
    <SafeAreaView style={s.safe}><View style={s.container}>
      <Text style={s.step}>Step 3 of 7</Text>
      <Text style={s.question}>What do you sell?</Text>
      <Text style={s.hint}>Tell us in your own words - cakes, tutoring, jewelry, anything!</Text>
      <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="e.g. Homemade cakes and brownies" placeholderTextColor={colors.warmGray} value={desc} onChangeText={setDesc} multiline autoFocus />
      <Button title="Next" onPress={() => router.push('/(auth)/onboarding/add-menu')} disabled={!desc.trim()} />
    </View></SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  step: { fontSize: 13, color: colors.warmGray, fontWeight: '500' },
  question: { fontSize: 28, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 14, color: colors.warmGray },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md, fontSize: 18, color: colors.ink, minHeight: 56 },
});
