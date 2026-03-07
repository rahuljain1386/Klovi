import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Button from '@/components/Button';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
    if (!error) setOtpSent(true);
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: otp.trim(), type: 'sms' });
    if (!error) router.replace('/(auth)/onboarding/language');
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}><Text style={{ color: colors.amber.DEFAULT }}>K</Text>LOVI</Text>
          <Text style={styles.subtitle}>Run your home business like a pro</Text>
        </View>
        <View style={{ gap: spacing.md }}>
          {!otpSent ? (
            <>
              <Text style={styles.label}>What's your phone number?</Text>
              <TextInput style={styles.input} placeholder="+91 98765 43210" placeholderTextColor={colors.warmGray} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoFocus />
              <Button title="Send Code" onPress={sendOtp} loading={loading} />
            </>
          ) : (
            <>
              <Text style={styles.label}>Enter the code we sent you</Text>
              <TextInput style={styles.input} placeholder="123456" placeholderTextColor={colors.warmGray} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} autoFocus />
              <Button title="Verify & Continue" onPress={verifyOtp} loading={loading} />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: { fontSize: 42, fontWeight: '900', color: colors.ink },
  subtitle: { fontSize: 16, color: colors.warmGray, marginTop: spacing.sm },
  label: { fontWeight: '600', fontSize: 20, color: colors.ink },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.md, fontSize: 18, color: colors.ink, minHeight: 56 },
});
