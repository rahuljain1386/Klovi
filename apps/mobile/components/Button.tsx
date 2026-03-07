import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors, borderRadius } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, variant === 'primary' && styles.primary, variant === 'secondary' && styles.secondary, variant === 'outline' && styles.outline, (disabled || loading) && styles.disabled, style]}
      onPress={onPress} disabled={disabled || loading} activeOpacity={0.8}
    >
      {loading ? <ActivityIndicator color={variant === 'outline' ? colors.ink : '#fff'} /> : (
        <Text style={[styles.text, variant === 'primary' && styles.textPrimary, variant === 'secondary' && styles.textSecondary, variant === 'outline' && styles.textOutline]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.xl, paddingVertical: 18, paddingHorizontal: 32, minHeight: 56 },
  primary: { backgroundColor: colors.amber.DEFAULT },
  secondary: { backgroundColor: colors.ink },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  disabled: { opacity: 0.5 },
  text: { fontWeight: '600', fontSize: 16 },
  textPrimary: { color: '#fff' },
  textSecondary: { color: colors.amber.DEFAULT },
  textOutline: { color: colors.ink },
});
