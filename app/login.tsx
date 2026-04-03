import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signIn } from '../src/services/authService';

const colors = {
  bg: '#07111F',
  bg2: '#0B1728',
  card: 'rgba(17, 28, 48, 0.92)',
  cardBorder: 'rgba(255,255,255,0.08)',
  primary: '#5AA9FF',
  primary2: '#7C5CFF',
  cyan: '#4BE1EC',
  green: '#42D392',
  red: '#FF6B7A',
  text: '#EEF4FF',
  textSoft: '#B8C7E3',
  textMuted: '#7F93B7',
  inputBg: 'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.10)',
  inputFocus: 'rgba(90,169,255,0.55)',
  white10: 'rgba(255,255,255,0.10)',
  white06: 'rgba(255,255,255,0.06)',
};

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const formValid = useMemo(() => {
    return email.trim().length > 4 && password.trim().length >= 6;
  }, [email, password]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing information', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login failed', error?.message || 'Something went wrong while signing in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <LinearGradient
        colors={[colors.bg, colors.bg2, '#08121E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <View style={styles.orbThree} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <LinearGradient
                colors={[colors.primary, colors.primary2]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoBox}
              >
                <Ionicons name="analytics" size={22} color="#fff" />
              </LinearGradient>

              <View>
                <Text style={styles.brandName}>RiskLens</Text>
                <Text style={styles.brandTag}>AI pricing & risk intelligence</Text>
              </View>
            </View>

            <Text style={styles.welcomeTitle}>Welcome back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to monitor products, simulate pricing scenarios, and unlock smarter business decisions.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardGlow} />

            <View style={styles.topBadge}>
              <Ionicons name="shield-checkmark" size={14} color={colors.green} />
              <Text style={styles.topBadgeText}>Secure Supabase Authentication</Text>
            </View>

            <Text style={styles.cardTitle}>Login to your account</Text>
            <Text style={styles.cardSubtitle}>
              Access your dashboard, CSV uploads, AI insights, and pricing recommendations.
            </Text>

            <View
              style={[
                styles.inputWrap,
                focusedField === 'email' && styles.inputWrapFocused,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={18}
                color={focusedField === 'email' ? colors.primary : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="Business email"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View
              style={[
                styles.inputWrap,
                focusedField === 'password' && styles.inputWrapFocused,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={focusedField === 'password' ? colors.primary : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { paddingRight: 44 }]}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.optionsRow}>
              <View style={styles.rememberRow}>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  trackColor={{ false: '#334866', true: '#2E62AF' }}
                  thumbColor="#fff"
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </View>

              <TouchableOpacity onPress={() => Alert.alert('Coming soon', 'Forgot password will be added next.')}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleLogin}
              disabled={loading || !formValid}
              style={[
                styles.loginButton,
                (!formValid || loading) && styles.loginButtonDisabled,
              ]}
            >
              <LinearGradient
                colors={
                  !formValid || loading
                    ? ['#36516F', '#36516F']
                    : [colors.primary, colors.primary2]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>Why RiskLens</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.featureGrid}>
              <View style={styles.featureCard}>
                <Ionicons name="sparkles-outline" size={18} color={colors.cyan} />
                <Text style={styles.featureTitle}>AI Insights</Text>
                <Text style={styles.featureText}>Actionable pricing recommendations</Text>
              </View>

              <View style={styles.featureCard}>
                <Ionicons name="warning-outline" size={18} color={colors.red} />
                <Text style={styles.featureTitle}>Risk Detection</Text>
                <Text style={styles.featureText}>Spot risky price decisions early</Text>
              </View>

              <View style={styles.featureCard}>
                <Ionicons name="trending-up-outline" size={18} color={colors.green} />
                <Text style={styles.featureTitle}>Profit Growth</Text>
                <Text style={styles.featureText}>Optimize revenue and margins</Text>
              </View>

              <View style={styles.featureCard}>
                <Ionicons name="bar-chart-outline" size={18} color={colors.primary} />
                <Text style={styles.featureTitle}>Scenario Testing</Text>
                <Text style={styles.featureText}>Model price changes before rollout</Text>
              </View>
            </View>

            <View style={styles.bottomRow}>
              <Text style={styles.bottomText}>Don&apos;t have an account?</Text>
              <TouchableOpacity onPress={() => router.push('/signup' as any)}>
                <Text style={styles.bottomLink}>Create one</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerInfo}>
            <Text style={styles.footerInfoText}>
              Business-grade analytics, secure authentication, and AI-powered pricing intelligence.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  orbOne: {
    position: 'absolute',
    top: -90,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(90,169,255,0.12)',
  },
  orbTwo: {
    position: 'absolute',
    right: -80,
    top: 130,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(75,225,236,0.08)',
  },
  orbThree: {
    position: 'absolute',
    left: 40,
    bottom: 90,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124,92,255,0.08)',
  },
  header: {
    marginBottom: 26,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  brandName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandTag: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  welcomeTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 10,
  },
  welcomeSubtitle: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 560,
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 22,
  },
  cardGlow: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(90,169,255,0.14)',
  },
  topBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white06,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 18,
  },
  topBadgeText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 22,
  },
  inputWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 18,
    marginBottom: 14,
    minHeight: 58,
  },
  inputWrapFocused: {
    borderColor: colors.inputFocus,
    shadowColor: colors.primary,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  inputIcon: {
    marginLeft: 14,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 16,
    paddingRight: 14,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsRow: {
    marginTop: 4,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    color: colors.textSoft,
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '600',
  },
  forgotText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  loginButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 22,
  },
  loginButtonDisabled: {
    opacity: 0.72,
  },
  loginButtonGradient: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.white10,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
    marginHorizontal: 10,
    fontWeight: '700',
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  featureCard: {
    width: '48.5%',
    backgroundColor: colors.white06,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 12,
  },
  featureTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  featureText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  bottomRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  bottomText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  bottomLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  footerInfo: {
    marginTop: 18,
    alignItems: 'center',
  },
  footerInfoText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 20,
    maxWidth: 560,
  },
});