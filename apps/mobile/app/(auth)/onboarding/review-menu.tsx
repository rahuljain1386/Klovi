import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import Button from '@/components/Button';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function ReviewMenuScreen() {
  const [items] = useState([{ name: 'Sample Item', price: 100, description: 'AI extracted item' }]);
  return (
    <SafeAreaView style={s.safe}><View style={s.container}>
      <Text style={s.step}>Step 5 of 7</Text>
      <Text style={s.question}>Does this look right?</Text>
      <Text style={s.hint}>Tap any item to edit. AI extracted these from your input.</Text>
      <FlatList data={items} keyExtractor={(_, i) => String(i)} style={{ flex: 1 }} renderItem={({ item }) => (
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={s.price}>{'\u20B9'}{item.price}</Text>
          </View>
          {item.description && <Text style={s.desc}>{item.description}</Text>}
        </View>
      )} />
      <Button title="Looks good!" onPress={() => router.push('/(auth)/onboarding/fulfillment')} />
    </View></SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { flex: 1, padding: spacing.lg },
  step: { fontSize: 13, color: colors.warmGray, marginBottom: spacing.sm, marginTop: spacing.xl, fontWeight: '500' },
  question: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  hint: { fontSize: 14, color: colors.warmGray, marginBottom: spacing.lg },
  card: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm },
  name: { fontWeight: '600', fontSize: 16, color: colors.ink },
  price: { fontWeight: '700', fontSize: 16, color: colors.amber.dark },
  desc: { fontSize: 13, color: colors.warmGray, marginTop: 4 },
});
