import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/constants/theme';

export default function Index() {
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: seller } = await supabase.from('sellers').select('status').eq('user_id', session.user.id).single();
        router.replace(seller?.status === 'active' ? '/(seller)/home' : '/(auth)/onboarding/language');
      } else {
        router.replace('/(auth)/login');
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}><Text style={{ color: colors.amber.DEFAULT }}>K</Text>LOVI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 48, fontWeight: '900', color: '#fff' },
});
