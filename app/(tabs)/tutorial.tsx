import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AppSidebar from '../../components/appsidebar';

const palette = {
  bg: '#F5F7F3',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF3EC',
  border: '#D7E1D3',
  text: '#132118',
  textSoft: '#425345',
  textMuted: '#728173',
  primary2: '#24583D',
  success: '#2D8A57',
  warning: '#C98A1F',
  danger: '#D94F4F',
  info: '#4475D9',
  purple: '#8B5CF6',
  greenSoft: '#EDF8F0',
  yellowSoft: '#FFF8E8',
  redSoft: '#FFF1F1',
  blueSoft: '#EDF3FF',
  purpleSoft: '#F3EEFF',
};

function StepCard({
  number,
  title,
  text,
  icon,
  tone = 'green',
}: {
  number: string;
  title: string;
  text: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
}) {
  const bgMap = {
    green: palette.greenSoft,
    yellow: palette.yellowSoft,
    red: palette.redSoft,
    blue: palette.blueSoft,
    purple: palette.purpleSoft,
  } as const;

  const colorMap = {
    green: palette.success,
    yellow: palette.warning,
    red: palette.danger,
    blue: palette.info,
    purple: palette.purple,
  } as const;

  return (
    <View style={styles.stepCard}>
      <View style={[styles.stepIconWrap, { backgroundColor: bgMap[tone] }]}>
        <Ionicons name={icon} size={20} color={colorMap[tone]} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.stepNumber}>Step {number}</Text>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

function FeatureCard({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={18} color={palette.primary2} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

export default function TutorialScreen() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.pageWrap}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#163728', '#1C4630', '#24583D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTop}>
              <View style={styles.heroTopLeft}>
                <TouchableOpacity
                  style={styles.heroMenuButton}
                  onPress={() => setSidebarOpen(true)}
                >
                  <Ionicons name="menu-outline" size={20} color="#fff" />
                </TouchableOpacity>

                <View style={styles.heroIconWrap}>
                  <MaterialCommunityIcons name="school-outline" size={24} color="#fff" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>User guide</Text>
                  <Text style={styles.heroTitle}>How to use RiskLens</Text>
                </View>
              </View>
            </View>

            <Text style={styles.heroSubtitle}>
              RiskLens helps food businesses upload product data, detect stock and expiry risk,
              understand weak margins, and make smarter pricing decisions with AI-assisted tools.
            </Text>
          </LinearGradient>

          <View style={styles.introCard}>
            <Text style={styles.introTitle}>What does RiskLens do?</Text>
            <Text style={styles.introText}>
              RiskLens turns a simple CSV file into a business intelligence dashboard. It checks
              product stock, expiry dates, cost prices, selling prices, suppliers and margins, then
              shows what needs attention before the business loses money.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Best workflow</Text>

          <View style={styles.stepsWrap}>
            <StepCard
              number="1"
              title="Prepare your CSV file"
              text="Create a CSV with product name, stock quantity, minimum stock level, cost price, expiry date and supplier name. Optional fields like category, SKU, barcode and selling price make the analysis stronger."
              icon="document-text-outline"
              tone="blue"
            />

            <StepCard
              number="2"
              title="Upload products"
              text="Go to Upload CSV and import the file. RiskLens automatically saves products and creates alerts and recommendations based on expiry, stock and margin problems."
              icon="cloud-upload-outline"
              tone="green"
            />

            <StepCard
              number="3"
              title="Check the dashboard"
              text="The dashboard gives the main overview: total products, inventory value, low stock, near expiry products, high-risk items and the most important actions."
              icon="grid-outline"
              tone="purple"
            />

            <StepCard
              number="4"
              title="Review products"
              text="Open Products to search, filter and inspect every item. You can see stock, expiry status, margin, risk score, supplier, SKU and barcode."
              icon="basket-outline"
              tone="green"
            />

            <StepCard
              number="5"
              title="Use Insights"
              text="Insights explains the business condition by category, supplier, alert severity and recommendation impact. This is useful for understanding where the biggest problems are."
              icon="analytics-outline"
              tone="blue"
            />

            <StepCard
              number="6"
              title="Use AI Pricing Lab"
              text="AI Pricing Lab lets you choose a business goal, generate pricing suggestions, review every recommendation and apply only the changes you trust."
              icon="sparkles-outline"
              tone="purple"
            />

            <StepCard
              number="7"
              title="Monitor waste and suppliers"
              text="Waste & Expiry shows products that may expire soon, while Supplier Performance shows which suppliers create the most stock, expiry or margin pressure."
              icon="warning-outline"
              tone="red"
            />
          </View>

          <Text style={styles.sectionTitle}>Main pages explained</Text>

          <View style={styles.featureGrid}>
            <FeatureCard
              icon="home-outline"
              title="Dashboard"
              text="Main command center for your business health."
            />
            <FeatureCard
              icon="cloud-upload-outline"
              title="Upload CSV"
              text="Imports product data and creates automatic intelligence."
            />
            <FeatureCard
              icon="basket-outline"
              title="Products"
              text="Search, filter and manage all inventory products."
            />
            <FeatureCard
              icon="analytics-outline"
              title="Insights"
              text="Explains category, supplier and recommendation signals."
            />
            <FeatureCard
              icon="flash-outline"
              title="Decision Center"
              text="Shows what actions the business should take next."
            />
            <FeatureCard
              icon="sparkles-outline"
              title="AI Pricing Lab"
              text="Suggests price changes based on your selected strategy."
            />
            <FeatureCard
              icon="time-outline"
              title="Pricing History"
              text="Stores previous AI pricing runs for review."
            />
            <FeatureCard
              icon="calendar-outline"
              title="Waste & Expiry"
              text="Finds products most likely to create waste."
            />
          </View>

          <View style={styles.bestPracticeCard}>
            <Text style={styles.bestPracticeTitle}>Best way to use it in a real business</Text>
            <Text style={styles.bestPracticeText}>
              Upload fresh product data every day or every few days. First check the Dashboard,
              then open Waste & Expiry to prevent losses, then check Supplier Performance to see
              which suppliers cause pressure. After that, use AI Pricing Lab to safely adjust prices.
              Never apply all AI pricing changes blindly — review the reasons and confidence first.
            </Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/(tabs)/upload')}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={palette.info} />
              <Text style={styles.secondaryButtonText}>Upload CSV</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/(tabs)')}
            >
              <Ionicons name="grid-outline" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Open Dashboard</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>

        <AppSidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          active="tutorial"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  pageWrap: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  hero: {
    borderRadius: 30,
    padding: 20,
    marginBottom: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroMenuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  introCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
  },
  introTitle: {
    color: palette.text,
    fontSize: 19,
    fontWeight: '900',
    marginBottom: 8,
  },
  introText: {
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  stepsWrap: {
    gap: 12,
    marginBottom: 20,
  },
  stepCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    gap: 12,
  },
  stepIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    color: palette.primary2,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  stepTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 5,
  },
  stepText: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '500',
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  featureCard: {
    width: '48.2%',
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: palette.border,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  featureText: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '500',
  },
  bestPracticeCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 18,
  },
  bestPracticeTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  bestPracticeText: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '600',
  },
  actionRow: {
    gap: 12,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: palette.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryButtonText: {
    color: palette.info,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: palette.primary2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});