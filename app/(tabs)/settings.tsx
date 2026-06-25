import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import AppSidebar from '../../components/appsidebar';
import { Text } from '../../components/app-text';
import { useLanguage, type Language } from '../../lib/i18n';
import { hasOpenAIKey } from '../../lib/aiChat';

const palette = {
  bg: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF3FA',
  border: '#D9E2F1',
  text: '#162033',
  textSoft: '#42516B',
  textMuted: '#738199',
  primary: '#5AA9FF',
  primary2: '#7C5CFF',
  success: '#42D392',
  greenSoft: '#EAFBF3',
  blueSoft: '#EAF4FF',
  purpleSoft: '#F3EEFF',
};

type LangOption = {
  code: Language;
  nativeName: string;
  label: string;
};

const LANGUAGES: LangOption[] = [
  { code: 'en', nativeName: 'English', label: 'English' },
  { code: 'sq', nativeName: 'Shqip', label: 'Albanian' },
];

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { language, setLanguage } = useLanguage();

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const selectLanguage = (code: Language) => {
    if (code === language) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLanguage(code);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#5AA9FF', '#6D7CFF', '#4BE1EC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.heroButton} onPress={() => setSidebarOpen(true)}>
                <Ionicons name="menu-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroButton} onPress={() => router.push('/(tabs)')}>
                <Ionicons name="grid-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroMain}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>Preferences</Text>
                <Text style={styles.heroTitle}>Settings</Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Preferences"
            title="Language"
            subtitle="Choose the language for the entire app."
          />

          <View style={styles.card}>
            {LANGUAGES.map((opt, index) => {
              const active = language === opt.code;
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={[styles.langRow, index < LANGUAGES.length - 1 && styles.langRowBorder]}
                  activeOpacity={0.85}
                  onPress={() => selectLanguage(opt.code)}
                >
                  <View style={[styles.langFlag, { backgroundColor: active ? palette.purpleSoft : palette.surfaceSoft }]}>
                    <Ionicons name="language" size={20} color={active ? palette.primary2 : palette.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {/* Native name stays untranslated so each language reads in its own tongue */}
                    <RNText style={styles.langName}>{opt.nativeName}</RNText>
                    <Text style={styles.langLabel}>{opt.label}</Text>
                  </View>
                  {active ? (
                    <View style={styles.checkWrap}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  ) : (
                    <View style={styles.radioEmpty} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.noteRow}>
            <Ionicons name="sparkles-outline" size={15} color={palette.primary2} />
            <Text style={styles.noteText}>Everything in the app updates instantly.</Text>
          </View>

          <SectionHeader eyebrow="About" title="About" subtitle="Smart inventory and risk analysis for food & drink markets." />

          <View style={styles.card}>
            <View style={[styles.aboutRow, styles.langRowBorder]}>
              <View style={[styles.langFlag, { backgroundColor: palette.blueSoft }]}>
                <MaterialCommunityIcons name="view-dashboard-outline" size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <RNText style={styles.langName}>RiskLens</RNText>
                <Text style={styles.langLabel}>Version</Text>
              </View>
              <RNText style={styles.aboutValue}>{appVersion}</RNText>
            </View>

            <View style={styles.aboutRow}>
              <View style={[styles.langFlag, { backgroundColor: palette.greenSoft }]}>
                <MaterialCommunityIcons name="robot-happy-outline" size={20} color={palette.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.langName}>Copilot</Text>
                <RNText style={styles.langLabel}>{hasOpenAIKey() ? 'GPT live' : 'On-device'}</RNText>
              </View>
              <View style={[styles.statusDot, { backgroundColor: hasOpenAIKey() ? palette.success : palette.textMuted }]} />
            </View>
          </View>

          <View style={{ height: 28 }} />
        </ScrollView>

        <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} active="settings" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { flex: 1, backgroundColor: palette.bg },
  scrollContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24 },

  hero: { borderRadius: 30, padding: 20, marginBottom: 20 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMain: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },

  sectionHeader: { marginTop: 2, marginBottom: 12 },
  sectionEyebrow: {
    color: palette.primary2,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionTitle: { color: palette.text, fontSize: 22, fontWeight: '900' },
  sectionSubtitle: { color: palette.textMuted, fontSize: 13, lineHeight: 19, marginTop: 5, fontWeight: '500' },

  card: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  langRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  langFlag: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  langName: { color: palette.text, fontSize: 15, fontWeight: '900', marginBottom: 2 },
  langLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  checkWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.primary2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioEmpty: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: palette.border },

  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, marginBottom: 20 },
  noteText: { color: palette.textSoft, fontSize: 12, fontWeight: '600', flex: 1 },

  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  aboutValue: { color: palette.textSoft, fontSize: 14, fontWeight: '800' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
