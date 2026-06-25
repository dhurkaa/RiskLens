import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '../components/app-text';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getFriendlyAuthErrorMessage, signIn } from '../src/services/authService';
import { DEMO_ACCOUNT, supabase } from '../lib/supabase';
import { useT } from '../lib/i18n';

const colors = {
  bg: '#F4F7FB',
  bg2: '#EAF1FB',
  card: '#FFFFFF',
  cardBorder: '#D9E2F1',
  primary: '#5AA9FF',
  primary2: '#7C5CFF',
  cyan: '#4BE1EC',
  green: '#42D392',
  red: '#FF6B7A',
  text: '#162033',
  textSoft: '#42516B',
  textMuted: '#738199',
  inputBg: '#F0F5FB',
  inputBorder: '#D9E2F1',
  inputFocus: 'rgba(90,169,255,0.55)',
  white10: 'rgba(90,169,255,0.14)',
  white06: 'rgba(90,169,255,0.08)',
};

export default function LoginScreen() {
  const router = useRouter();
  const t = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password;
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);

  const formValid = useMemo(() => {
    return emailLooksValid && cleanPassword.trim().length >= 6;
  }, [cleanPassword, emailLooksValid]);

  const errors = useMemo(() => {
    return {
      email:
        touched.email && !cleanEmail
          ? 'Please enter your email address.'
          : touched.email && !emailLooksValid
          ? 'Please enter a valid email address.'
          : '',
      password:
        touched.password && !cleanPassword.trim()
          ? 'Please enter your password.'
          : touched.password && cleanPassword.trim().length < 6
          ? 'Password must be at least 6 characters.'
          : '',
    };
  }, [cleanEmail, cleanPassword, emailLooksValid, touched.email, touched.password]);

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active && session) {
        router.replace('/(tabs)');
      }
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session) {
        router.replace('/(tabs)');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    setMessage(null);

    if (!formValid) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({
        type: 'error',
        text: 'Please fix the highlighted fields before signing in.',
      });
      return;
    }

    try {
      setLoading(true);
      await signIn(cleanEmail, cleanPassword);
      router.replace('/(tabs)');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({
        type: 'error',
        text: getFriendlyAuthErrorMessage(error, 'login'),
      });
      setTouched({ email: true, password: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    if (loading) return;

    const demoEmail = DEMO_ACCOUNT.email;
    const demoPassword = DEMO_ACCOUNT.password;

    setEmail(demoEmail);
    setPassword(demoPassword);
    setMessage(null);

    try {
      setLoading(true);
      await signIn(demoEmail, demoPassword);
      router.replace('/(tabs)');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: getFriendlyAuthErrorMessage(error, 'login'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !window.location.search.includes('demo=1')
    ) {
      return;
    }

    let active = true;

    const loginDemoWorkspace = async () => {
      const demoEmail = DEMO_ACCOUNT.email;
      const demoPassword = DEMO_ACCOUNT.password;

      setEmail(demoEmail);
      setPassword(demoPassword);

      try {
        setLoading(true);
        await signIn(demoEmail, demoPassword);
        if (active) router.replace('/(tabs)');
      } catch (error: any) {
        if (active) {
          setMessage({
            type: 'error',
            text: getFriendlyAuthErrorMessage(error, 'login'),
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loginDemoWorkspace();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <LinearGradient
        colors={[colors.bg, colors.bg2, '#F8FBFF']}
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

            {message ? (
              <View
                style={[
                  styles.messageBox,
                  message.type === 'success' ? styles.successBox : styles.errorBox,
                ]}
              >
                <Ionicons
                  name={
                    message.type === 'success'
                      ? 'checkmark-circle-outline'
                      : 'alert-circle-outline'
                  }
                  size={18}
                  color={message.type === 'success' ? colors.green : colors.red}
                  style={styles.messageIcon}
                />
                <Text
                  style={[
                    styles.messageText,
                    { color: message.type === 'success' ? colors.green : colors.red },
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            ) : null}

            <View
              style={[
                styles.inputWrap,
                errors.email ? styles.inputWrapError : null,
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
                onChangeText={(value) => {
                  setEmail(value);
                  if (message) setMessage(null);
                }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched((prev) => ({ ...prev, email: true }));
                }}
                placeholder={t('Business email')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

            <View
              style={[
                styles.inputWrap,
                errors.password ? styles.inputWrapError : null,
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
                onChangeText={(value) => {
                  setPassword(value);
                  if (message) setMessage(null);
                }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => {
                  setFocusedField(null);
                  setTouched((prev) => ({ ...prev, password: true }));
                }}
                placeholder={t('Password')}
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
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <View style={styles.sessionNoteRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
              <Text style={styles.sessionNoteText}>
                Your secure session stays active until you log out.
              </Text>
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
                    ? ['#CBD5E1', '#CBD5E1']
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

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleDemoLogin}
              disabled={loading}
              style={styles.demoButton}
            >
              <View style={styles.demoIcon}>
                <Ionicons name="rocket-outline" size={18} color={colors.primary2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoTitle}>Use demo workspace</Text>
                <Text style={styles.demoSubtitle}>
                  Preloaded products, alerts, recommendations, and pricing history.
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.primary2} />
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
              <TouchableOpacity onPress={() => router.push('/signup')}>
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
    letterSpacing: 0,
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
    letterSpacing: 0,
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
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  successBox: {
    backgroundColor: '#EAFBF3',
    borderColor: 'rgba(22,160,105,0.24)',
  },
  errorBox: {
    backgroundColor: '#FFF1F3',
    borderColor: 'rgba(217,75,94,0.24)',
  },
  messageIcon: {
    marginTop: 1,
    marginRight: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
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
  inputWrapError: {
    borderColor: 'rgba(217,75,94,0.75)',
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
  errorText: {
    color: colors.red,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10,
    marginLeft: 2,
    fontWeight: '600',
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionNoteRow: {
    marginTop: 4,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionNoteText: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  loginButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
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
  demoButton: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white06,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  demoIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(124,92,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 3,
  },
  demoSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
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
