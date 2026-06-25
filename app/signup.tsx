import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Text } from '../components/app-text';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { getFriendlyAuthErrorMessage, signUp } from '../src/services/authService';

const palette = {
  bg: '#F4F7FB',
  bg2: '#EAF1FB',
  card: '#FFFFFF',
  input: '#F0F5FB',
  border: '#D9E2F1',
  text: '#162033',
  textSoft: '#42516B',
  textMuted: '#738199',
  primary: '#5AA9FF',
  primary2: '#7C5CFF',
  primarySoft: '#5AA9FF',
  success: '#16A069',
  warning: '#B7791F',
  danger: '#D94B5E',
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const getPasswordStrength = (value: string) => {
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;

  if (score <= 1) return { label: 'Weak', color: palette.danger, width: '30%' as const };
  if (score <= 3) return { label: 'Medium', color: palette.warning, width: '65%' as const };
  return { label: 'Strong', color: palette.success, width: '100%' as const };
};

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [touched, setTouched] = useState({
    fullName: false,
    company: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();
  const cleanConfirmPassword = confirmPassword.trim();

  const errors = useMemo(() => {
    return {
      fullName:
        touched.fullName && !fullName.trim()
          ? 'Please enter your full name.'
          : '',
      company:
        touched.company && !company.trim()
          ? 'Please enter your company or workspace name.'
          : '',
      email:
        touched.email && !cleanEmail
          ? 'Please enter your email address.'
          : touched.email && !isValidEmail(cleanEmail)
          ? 'Please enter a valid email address.'
          : '',
      password:
        touched.password && !cleanPassword
          ? 'Please create a password.'
          : touched.password && cleanPassword.length < 8
          ? 'Password must be at least 8 characters.'
          : touched.password && !/[A-Z]/.test(cleanPassword)
          ? 'Password must include at least 1 uppercase letter.'
          : touched.password && !/[0-9]/.test(cleanPassword)
          ? 'Password must include at least 1 number.'
          : '',
      confirmPassword:
        touched.confirmPassword && !cleanConfirmPassword
          ? 'Please confirm your password.'
          : touched.confirmPassword && cleanConfirmPassword !== cleanPassword
          ? 'Passwords do not match.'
          : '',
    };
  }, [
    touched,
    fullName,
    company,
    cleanEmail,
    cleanPassword,
    cleanConfirmPassword,
  ]);

  const passwordStrength = useMemo(
    () => getPasswordStrength(cleanPassword),
    [cleanPassword]
  );

  const formValid =
    fullName.trim() &&
    company.trim() &&
    isValidEmail(cleanEmail) &&
    cleanPassword.length >= 8 &&
    /[A-Z]/.test(cleanPassword) &&
    /[0-9]/.test(cleanPassword) &&
    cleanPassword === cleanConfirmPassword;

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
  }, []);

  const handleSignup = async () => {
    setTouched({
      fullName: true,
      company: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    setMessage(null);

    if (!formValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({
        type: 'error',
        text: 'Please complete all fields correctly before creating your account.',
      });
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { session } = await signUp({
        company: company.trim(),
        email: cleanEmail,
        fullName: fullName.trim(),
        password: cleanPassword,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (session) {
        router.replace('/(tabs)');
        return;
      }

      setMessage({
        type: 'success',
        text: 'Your account has been created. You can continue to the app as soon as authentication becomes available for this account.',
      });

      setFullName('');
      setCompany('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setTouched({
        fullName: false,
        company: false,
        email: false,
        password: false,
        confirmPassword: false,
      });
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      setMessage({
        type: 'error',
        text: getFriendlyAuthErrorMessage(error, 'signup'),
      });
    } finally {
      setLoading(false);
    }
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
                  <Ionicons name="sparkles-outline" size={34} color="#FFFFFF" />
                </LinearGradient>
              </View>

              <Text style={styles.eyebrow}>Create your RiskLens workspace</Text>
              <Text style={styles.title}>Start turning CSV data into decisions</Text>
              <Text style={styles.subtitle}>
                Upload pricing data, analyze market patterns, and receive
                AI-powered insights built around your business.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.featureItem}>
                <Ionicons name="document-text-outline" size={18} color={palette.primarySoft} />
                <Text style={styles.featureText}>Upload CSV files securely</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="analytics-outline" size={18} color={palette.primarySoft} />
                <Text style={styles.featureText}>Analyze pricing and risk trends</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="globe-outline" size={18} color={palette.primarySoft} />
                <Text style={styles.featureText}>Compare with market intelligence</Text>
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
                    style={{ marginTop: 1, marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.messageText,
                      {
                        color:
                          message.type === 'success' ? palette.success : palette.danger,
                      },
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full name</Text>
                <View style={[styles.inputWrap, errors.fullName ? styles.inputWrapError : null]}>
                  <Ionicons name="person-outline" size={18} color={palette.textMuted} style={styles.leftIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor={palette.textMuted}
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      if (message) setMessage(null);
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, fullName: true }))}
                    editable={!loading}
                  />
                </View>
                <FieldError text={errors.fullName} />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Company / workspace</Text>
                <View style={[styles.inputWrap, errors.company ? styles.inputWrapError : null]}>
                  <Ionicons name="business-outline" size={18} color={palette.textMuted} style={styles.leftIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your company name"
                    placeholderTextColor={palette.textMuted}
                    value={company}
                    onChangeText={(text) => {
                      setCompany(text);
                      if (message) setMessage(null);
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, company: true }))}
                    editable={!loading}
                  />
                </View>
                <FieldError text={errors.company} />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email address</Text>
                <View style={[styles.inputWrap, errors.email ? styles.inputWrapError : null]}>
                  <Ionicons name="mail-outline" size={18} color={palette.textMuted} style={styles.leftIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@company.com"
                    placeholderTextColor={palette.textMuted}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (message) setMessage(null);
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
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
                <View style={[styles.inputWrap, errors.password ? styles.inputWrapError : null]}>
                  <Ionicons name="lock-closed-outline" size={18} color={palette.textMuted} style={styles.leftIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a secure password"
                    placeholderTextColor={palette.textMuted}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (message) setMessage(null);
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
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

                {cleanPassword.length > 0 && (
                  <View style={styles.strengthRow}>
                    <View style={styles.strengthTrack}>
                      <View
                        style={[
                          styles.strengthFill,
                          {
                            width: passwordStrength.width,
                            backgroundColor: passwordStrength.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                      {passwordStrength.label}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <View
                  style={[
                    styles.inputWrap,
                    errors.confirmPassword ? styles.inputWrapError : null,
                  ]}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color={palette.textMuted} style={styles.leftIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Repeat your password"
                    placeholderTextColor={palette.textMuted}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (message) setMessage(null);
                    }}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, confirmPassword: true }))
                    }
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setShowConfirmPassword((prev) => !prev)
                    }
                    style={styles.rightIconButton}
                    disabled={loading}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={18}
                      color={palette.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                <FieldError text={errors.confirmPassword} />
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!formValid || loading) && styles.primaryButtonDisabled,
                ]}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={
                    !formValid || loading
                      ? ['#CBD5E1', '#CBD5E1']
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
                      <Text style={styles.primaryButtonText}>Create account</Text>
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

              <Text style={styles.bottomText}>
                By creating an account, you can store uploads, review analysis
                history, and build AI-powered pricing reports for your data.
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
    letterSpacing: 0,
  },
  subtitle: {
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 340,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.84)',
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
    backgroundColor: '#FFFFFF',
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
  errorText: {
    color: palette.danger,
    fontSize: 12,
    marginTop: 7,
    marginLeft: 2,
    fontWeight: '600',
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },
  strengthTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#D9E2F1',
    borderRadius: 999,
    overflow: 'hidden',
    marginRight: 10,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 999,
  },
  strengthLabel: {
    minWidth: 58,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'right',
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
    backgroundColor: '#EAFBF3',
    borderColor: 'rgba(22,160,105,0.24)',
  },
  errorBox: {
    backgroundColor: '#FFF1F3',
    borderColor: 'rgba(217,75,94,0.24)',
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
