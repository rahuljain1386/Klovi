import { View, Text, StyleSheet, SafeAreaView, Share } from 'react-native';
import { router } from 'expo-router';
import Button from '@/components/Button';
import { colors, spacing } from '@/constants/theme';

export default function LiveScreen() {
  const url = 'klovi.com/yourshop';
  return (
    <SafeAreaView style={s.safe}><View style={s.container}>
      <Text style={{ fontSize: 64 }}>{'\u{1F389}'}</Text>
      <Text style={s.title}>Your shop is live!</Text>
      <Text style={s.sub}>Share your link with customers and start taking orders</Text>
      <View style={s.linkBox}><Text style={s.linkLabel}>Your booking page</Text><Text style={s.link}>{url}</Text></View>
      <View style={{ width: '100%', gap: spacing.md }}>
        <Button title="Share Your Link" onPress={() => Share.share({ message: `Check out my shop! https://${url}` })} />
        <Button title="Go to Dashboard" onPress={() => router.replace('/(seller)/home')} variant="secondary" />
      </View>
    </View></SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.sm },
  sub: { fontSize: 16, color: colors.warmGray, textAlign: 'center', marginBottom: spacing.xl },
  linkBox: { backgroundColor: colors.ink, borderRadius: 16, padding: spacing.lg, width: '100%', alignItems: 'center', marginBottom: spacing.xl },
  linkLabel: { fontSize: 12, color: colors.warmGray, marginBottom: spacing.xs },
  link: { fontSize: 20, fontWeight: '700', color: colors.amber.DEFAULT },
});
