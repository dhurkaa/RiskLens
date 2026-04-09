import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

const palette = {
  bg: '#0B1016',
  bg2: '#101826',
  card: '#131C27',
  input: '#192433',
  border: 'rgba(255,255,255,0.08)',
  text: '#F8FAFC',
  textSoft: '#CBD5E1',
  textMuted: '#94A3B8',
  primary: '#3B82F6',
  primary2: '#2563EB',
  primarySoft: '#93C5FD',
  success: '#10B981',
  danger: '#EF4444',
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  const errors = useMemo(() => {
    return {
      email:
        touched.email && !cleanEmail
          ? 'Please enter your email address.'
          : touched.email && !isValidEmail(cleanEmail)
          ? 'Please enter a valid email address.'
          : '',
      password:
        touched.password && !cleanPassword
          ? 'Please enter your password.'
          : '',
    };
  }, [touched, cleanEmail, cleanPassword]);

  const formValid = isValidEmail(cleanEmail) && !!cleanPassword;

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    setMessage(null);

    if (!formValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({
        type: 'error',
        text: 'Please enter a valid email and password to continue.',
      });
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setMessage({
  type: 'success',
  text: 'Signed in successfully. Redirecting to your workspace...',
});

router.replace('/(tabs)');

      // Optional redirect after success
      // router.replace('/(tabs)');
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      setMessage({
        type: 'error',
        text:
          error?.message ||
          'Something went wrong while signing in. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setTouched((prev) => ({ ...prev, email: true }));
    setMessage(null);

    if (!isValidEmail(cleanEmail)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({
        type: 'error',
        text: 'Enter a valid email address first to reset your password.',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setMessage({
        type: 'success',
        text: 'Password reset email sent. Please check your inbox.',
      });
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      setMessage({
        type: 'error',
        text:
          error?.message ||
          'Could not send reset email. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const goToSignup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/signup');
  };

  const FieldError = ({ text }: { text: string }) =>
    text ? <Text style={styles.errorText}>{text}</Text> : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[palette.bg, palette.bg2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.topSection}>
              <View style={styles.logoWrap}>
                <LinearGradient
                  colors={[palette.primary, palette.primary2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoCircle}
                >
                  <Ionicons name="analytics-outline" size={34} color="#FFFFFF" />
                </LinearGradient>
              </View>

              <Text style={styles.eyebrow}>Welcome back to RiskLens</Text>
              <Text style={styles.title}>Sign in to your workspace</Text>
              <Text style={styles.subtitle}>
                Continue with your CSV uploads, pricing analysis, market research,
                and AI-generated business insights.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.featureItem}>
                <Ionicons
                  name="cloud-upload-outline"
                  size={18}
                  color={palette.primarySoft}
                />
                <Text style={styles.featureText}>
                  Access your uploaded CSV files
                </Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons
                  name="bar-chart-outline"
                  size={18}
                  color={palette.primarySoft}
                />
                <Text style={styles.featureText}>
                  Review pricing and risk analysis
                </Text>
              </View>

              <View style={styles.featureItem}>
                <Ionicons
                  name="sparkles-outline"
                  size={18}
                  color={palette.primarySoft}
                />
                <Text style={styles.featureText}>
                  Continue your AI-powered insights
                </Text>
              </View>
            </View>

            <View style={styles.formCard}>
              {message && (
                <View
                  style={[
                    styles.messageBox,
                    message.type === 'success'
                      ? styles.successBox
                      : styles.errorBox,
                  ]}
                >
                  <Ionicons
                    name={
                      message.type === 'success'
                        ? 'checkmark-circle-outline'
                        : 'alert-circle-outline'
                    }
                    size={18}
                    color={
                      message.type === 'success'
                        ? palette.success
                        : palette.danger
                    }
                    style={styles.messageIcon}
                  />
                  <Text
                    style={[
                      styles.messageText,
                      {
                        color:
                          message.type === 'success'
                            ? '#BBF7D0'
                            : '#FECACA',
                      },
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email address</Text>
                <View
                  style={[
                    styles.inputWrap,
                    errors.email ? styles.inputWrapError : null,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={palette.textMuted}
                    style={styles.leftIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="you@company.com"
                    placeholderTextColor={palette.textMuted}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (message) setMessage(null);
                    }}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, email: true }))
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!loading}
                  />
                </View>
                <FieldError text={errors.email} />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View
                  style={[
                    styles.inputWrap,
                    errors.password ? styles.inputWrapError : null,
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={palette.textMuted}
                    style={styles.leftIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={palette.textMuted}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (message) setMessage(null);
                    }}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, password: true }))
                    }
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    style={styles.rightIconButton}
                    disabled={loading}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={18}
                      color={palette.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                <FieldError text={errors.password} />
              </View>

              <TouchableOpacity
                onPress={handlePasswordReset}
                disabled={loading}
                style={styles.forgotButton}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!formValid || loading) && styles.primaryButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={!formValid || loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={
                    !formValid || loading
                      ? ['#334155', '#334155']
                      : [palette.primary, palette.primary2]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButtonInner}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Sign in</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color="#FFFFFF"
                        style={{ marginLeft: 8 }}
                      />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={goToSignup}
                style={styles.switchButton}
                disabled={loading}
              >
                <Text style={styles.switchText}>
                  Don&apos;t have an account?{' '}
                  <Text style={styles.switchLink}>Create one</Text>
                </Text>
              </TouchableOpacity>

              <Text style={styles.bottomText}>
                Sign in to manage uploads, view reports, and continue using
                RiskLens for pricing analysis and market intelligence.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 32,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoWrap: {
    marginBottom: 18,
  },
  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  eyebrow: {
    color: palette.primarySoft,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 10,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },
  infoCard: {
    backgroundColor: 'rgba(19,28,39,0.88)',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    color: palette.textSoft,
    marginLeft: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: 'rgba(19,28,39,0.95)',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 22,
    padding: 18,
  },
  fieldGroup: {
    marginBottom: 15,
  },
  label: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputWrap: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: palette.input,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapError: {
    borderColor: 'rgba(239,68,68,0.75)',
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    minHeight: 56,
  },
  rightIconButton: {
    padding: 8,
    marginLeft: 8,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 14,
  },
  forgotText: {
    color: palette.primarySoft,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginTop: 7,
    marginLeft: 2,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.85,
  },
  primaryButtonInner: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  switchButton: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    color: palette.textSoft,
    fontSize: 14,
    textAlign: 'center',
  },
  switchLink: {
    color: palette.primarySoft,
    fontWeight: '800',
  },
  bottomText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
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
    backgroundColor: 'rgba(6,78,59,0.22)',
    borderColor: 'rgba(16,185,129,0.35)',
  },
  errorBox: {
    backgroundColor: 'rgba(127,29,29,0.22)',
    borderColor: 'rgba(239,68,68,0.35)',
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
});