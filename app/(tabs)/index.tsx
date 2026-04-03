import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

/**
 * RiskLens - app/(tabs)/index.tsx
 *
 * Premium dashboard foundation with professional dark minimalist style.
 * Clean slate/graphite palette, no decorative orbs, focus on data.
 */

const { width, height } = Dimensions.get('window');

type RiskLevel = 'Low' | 'Medium' | 'High';
type Trend = 'up' | 'down' | 'stable';
type StrategyGoal = 'Balanced' | 'Fast Sales' | 'Max Profit';
type ScenarioMode = 'Increase' | 'Decrease' | 'Test';

type UploadSummary = {
  id: string;
  periodLabel: string;
  records: number;
  products: number;
  totalRevenue: number;
  totalProfit: number;
  avgConfidence: number;
};

type DashboardKPI = {
  id: string;
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  icon: keyof typeof Ionicons.glyphMap;
};

type ProductAnalytics = {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentPrice: number;
  suggestedPrice: number;
  costPrice: number;
  stockLevel: number;
  unitsSold: number;
  revenue: number;
  profit: number;
  demandIndex: number;
  competitionStrength: number;
  elasticity: number;
  confidence: number;
  risk: RiskLevel;
  trend: Trend;
  expectedSalesChange: number;
  expectedProfitChange: number;
  aiNote: string;
};

type ScenarioPreview = {
  id: string;
  title: string;
  mode: ScenarioMode;
  percent: number;
  expectedSalesChange: number;
  expectedProfitChange: number;
  risk: RiskLevel;
  confidence: number;
  note: string;
};

type AIRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  target: string;
};

type AlertSignal = {
  id: string;
  title: string;
  message: string;
  level: RiskLevel;
  timestamp: string;
};

type FeedInsight = {
  id: string;
  headline: string;
  summary: string;
  impact: string;
};

// Professional dark minimalist palette (Slate & Graphite)
const palette = {
  bg: '#0F1218',        // main background
  bg2: '#11151C',       // secondary background
  panel: '#1A1F2A',     // card background
  panel2: '#1E2430',    // card hover/active background
  panel3: '#252C3A',    // deeper panel
  border: 'rgba(255,255,255,0.06)',
  borderSoft: 'rgba(255,255,255,0.03)',
  white: '#F8FAFF',
  text: '#EDF2F7',
  textSoft: '#A0AEC0',
  textMuted: '#718096',
  blue: '#3B82F6',      // single accent color
  blue2: '#2563EB',
  cyan: '#22D3EE',
  green: '#10B981',
  red: '#EF4444',
  orange: '#F59E0B',
  yellow: '#FBBF24',
  purple: '#8B5CF6',
  pink: '#EC4899',
  chip: 'rgba(255,255,255,0.05)',
  chip2: 'rgba(255,255,255,0.03)',
  shadow: 'rgba(0,0,0,0.4)',
};

const uploadSummary: UploadSummary = {
  id: 'up1',
  periodLabel: 'Last 30 days',
  records: 12480,
  products: 428,
  totalRevenue: 248720,
  totalProfit: 68400,
  avgConfidence: 84,
};

const dashboardKpis: DashboardKPI[] = [
  {
    id: 'k1',
    label: 'Projected Revenue',
    value: '€284,200',
    delta: '+12.8%',
    positive: true,
    icon: 'bar-chart-outline',
  },
  {
    id: 'k2',
    label: 'Projected Profit',
    value: '€78,930',
    delta: '+9.1%',
    positive: true,
    icon: 'cash-outline',
  },
  {
    id: 'k3',
    label: 'High Risk Products',
    value: '9',
    delta: '-2',
    positive: true,
    icon: 'warning-outline',
  },
  {
    id: 'k4',
    label: 'Model Confidence',
    value: '84%',
    delta: '+4.3%',
    positive: true,
    icon: 'shield-checkmark-outline',
  },
];

const products: ProductAnalytics[] = [
  {
    id: 'p1',
    name: 'Wireless Headphones Pro',
    sku: 'WHP-001',
    category: 'Electronics',
    currentPrice: 129,
    suggestedPrice: 136.5,
    costPrice: 74,
    stockLevel: 140,
    unitsSold: 264,
    revenue: 34056,
    profit: 14520,
    demandIndex: 84,
    competitionStrength: 56,
    elasticity: 1.1,
    confidence: 89,
    risk: 'Low',
    trend: 'up',
    expectedSalesChange: -2,
    expectedProfitChange: 10,
    aiNote: 'Strong demand and stable competition support a measured price increase.',
  },
  {
    id: 'p2',
    name: 'Smart Blender Max',
    sku: 'SBM-031',
    category: 'Home Appliances',
    currentPrice: 92,
    suggestedPrice: 88,
    costPrice: 52,
    stockLevel: 85,
    unitsSold: 148,
    revenue: 13616,
    profit: 5920,
    demandIndex: 61,
    competitionStrength: 79,
    elasticity: 1.8,
    confidence: 76,
    risk: 'Medium',
    trend: 'stable',
    expectedSalesChange: 7,
    expectedProfitChange: 2,
    aiNote: 'Slightly overpriced relative to current competitive pressure.',
  },
  {
    id: 'p3',
    name: 'Eco Running Shoes',
    sku: 'ERS-108',
    category: 'Fashion',
    currentPrice: 74,
    suggestedPrice: 79,
    costPrice: 33,
    stockLevel: 215,
    unitsSold: 311,
    revenue: 23014,
    profit: 12751,
    demandIndex: 77,
    competitionStrength: 46,
    elasticity: 0.95,
    confidence: 86,
    risk: 'Low',
    trend: 'up',
    expectedSalesChange: -3,
    expectedProfitChange: 11,
    aiNote: 'Healthy brand pull with moderate price resilience.',
  },
  {
    id: 'p4',
    name: 'Ergonomic Desk Lamp',
    sku: 'EDL-009',
    category: 'Office',
    currentPrice: 46,
    suggestedPrice: 41,
    costPrice: 20,
    stockLevel: 58,
    unitsSold: 72,
    revenue: 3312,
    profit: 1872,
    demandIndex: 54,
    competitionStrength: 82,
    elasticity: 2.2,
    confidence: 71,
    risk: 'High',
    trend: 'down',
    expectedSalesChange: 12,
    expectedProfitChange: -4,
    aiNote: 'Current market pressure makes this SKU very sensitive to price.',
  },
  {
    id: 'p5',
    name: 'Protein Snack Box',
    sku: 'PSB-420',
    category: 'Food',
    currentPrice: 18,
    suggestedPrice: 18.8,
    costPrice: 8,
    stockLevel: 420,
    unitsSold: 612,
    revenue: 11016,
    profit: 6120,
    demandIndex: 88,
    competitionStrength: 49,
    elasticity: 0.8,
    confidence: 90,
    risk: 'Low',
    trend: 'up',
    expectedSalesChange: -1,
    expectedProfitChange: 9,
    aiNote: 'Strong repeat demand supports a careful margin lift.',
  },
];

const scenarios: ScenarioPreview[] = [
  {
    id: 's1',
    title: 'Increase by 5%',
    mode: 'Increase',
    percent: 5,
    expectedSalesChange: -2,
    expectedProfitChange: 8,
    risk: 'Low',
    confidence: 87,
    note: 'Safe for resilient products.',
  },
  {
    id: 's2',
    title: 'Increase by 10%',
    mode: 'Increase',
    percent: 10,
    expectedSalesChange: -7,
    expectedProfitChange: 12,
    risk: 'Medium',
    confidence: 81,
    note: 'Higher upside, moderate demand sensitivity.',
  },
  {
    id: 's3',
    title: 'Decrease by 8%',
    mode: 'Decrease',
    percent: -8,
    expectedSalesChange: 10,
    expectedProfitChange: -3,
    risk: 'Medium',
    confidence: 78,
    note: 'Useful for stock turnover or competitive defense.',
  },
  {
    id: 's4',
    title: 'Decrease by 15%',
    mode: 'Decrease',
    percent: -15,
    expectedSalesChange: 19,
    expectedProfitChange: -10,
    risk: 'High',
    confidence: 73,
    note: 'Only for clearance or short-term campaigns.',
  },
];

const recommendations: AIRecommendation[] = [
  {
    id: 'r1',
    title: 'Increase price on high-resilience electronics',
    description: 'Demand remains strong while competitive pressure is still manageable.',
    priority: 'High',
    target: 'Wireless Headphones Pro',
  },
  {
    id: 'r2',
    title: 'Reduce price slightly on blender category',
    description: 'The product is price-sensitive and currently loses share in comparison-heavy contexts.',
    priority: 'Medium',
    target: 'Smart Blender Max',
  },
  {
    id: 'r3',
    title: 'Avoid aggressive discounting on healthy repeat-purchase items',
    description: 'These products already have solid velocity and can preserve margins.',
    priority: 'Low',
    target: 'Protein Snack Box',
  },
];

const alerts: AlertSignal[] = [
  {
    id: 'a1',
    title: 'High-risk SKU detected',
    message: 'Ergonomic Desk Lamp has rising price sensitivity and weak demand momentum.',
    level: 'High',
    timestamp: '2m ago',
  },
  {
    id: 'a2',
    title: 'Safe margin opportunity',
    message: 'Eco Running Shoes can support a moderate price increase without heavy sales loss.',
    level: 'Low',
    timestamp: '9m ago',
  },
  {
    id: 'a3',
    title: 'Competitive pressure rising',
    message: 'Smart Blender Max faces stronger promotional pricing from nearby competitors.',
    level: 'Medium',
    timestamp: '18m ago',
  },
];

const feed: FeedInsight[] = [
  {
    id: 'f1',
    headline: 'The portfolio supports selective increases, not broad discounting.',
    summary:
      'Current demand quality and margin buffers suggest more upside from targeted price lifts than from across-the-board promotions.',
    impact: 'Revenue growth opportunity',
  },
  {
    id: 'f2',
    headline: 'Competition pressure is concentrated, not universal.',
    summary:
      'Only a subset of products shows real vulnerability to pricing pressure. Treat those SKUs individually instead of lowering everything.',
    impact: 'Risk reduction',
  },
  {
    id: 'f3',
    headline: 'Confidence improves when upload data is consistent across time periods.',
    summary:
      'CSV uploads that preserve product identifiers, categories, prices, and time periods create stronger AI recommendations and cleaner what-if simulations.',
    impact: 'Model reliability',
  },
];

function formatCurrency(value: number) {
  return `€${value.toFixed(2)}`;
}

function riskColor(risk: RiskLevel) {
  if (risk === 'Low') return palette.green;
  if (risk === 'Medium') return palette.yellow;
  return palette.red;
}

function priorityColor(priority: AIRecommendation['priority']) {
  if (priority === 'High') return palette.red;
  if (priority === 'Medium') return palette.yellow;
  return palette.green;
}

function trendArrow(trend: Trend) {
  if (trend === 'up') return '↗';
  if (trend === 'down') return '↘';
  return '→';
}

// Animated card wrapper for entrance animations
const AnimatedCard = ({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, [fadeAnim, translateY, delay]);

  return (
    <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

function SectionHeader({
  title,
  subtitle,
  action,
  onPress,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {!!action && (
        <TouchableOpacity
          style={styles.sectionActionButton}
          onPress={() => {
            if (onPress) onPress();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionActionText}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function InfoBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.infoBadge, { borderColor: `${color}55`, backgroundColor: `${color}20` }]}>
      <Text style={styles.infoBadgeLabel}>{label}</Text>
      <Text style={[styles.infoBadgeValue, { color }]}>{value}</Text>
    </View>
  );
}

function RiskPill({ label }: { label: RiskLevel | string }) {
  const color = label === 'Low' ? palette.green : label === 'Medium' ? palette.yellow : palette.red;
  const bg = label === 'Low' ? 'rgba(16,185,129,0.12)' : label === 'Medium' ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.12)';

  return (
    <View style={[styles.riskPill, { backgroundColor: bg, borderColor: `${color}55` }]}>
      <Text style={[styles.riskPillText, { color }]}>{label}</Text>
    </View>
  );
}

function SummaryChip({
  icon,
  title,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.summaryChip}>
      <View style={[styles.summaryChipIconWrap, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.summaryChipTitle}>{title}</Text>
      <Text style={styles.summaryChipValue}>{value}</Text>
    </View>
  );
}

function KPIWidget({ item }: { item: DashboardKPI }) {
  return (
    <View style={styles.kpiWidget}>
      <View style={styles.kpiTopRow}>
        <View style={styles.kpiIconWrap}>
          <Ionicons name={item.icon} size={18} color={palette.blue} />
        </View>
        <View style={[styles.kpiDeltaPill, { backgroundColor: item.positive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
          <Text style={[styles.kpiDeltaText, { color: item.positive ? palette.green : palette.red }]}>{item.delta}</Text>
        </View>
      </View>
      <Text style={styles.kpiLabel}>{item.label}</Text>
      <Text style={styles.kpiValue}>{item.value}</Text>
    </View>
  );
}

function UploadOverviewCard() {
  return (
    <View style={styles.uploadOverviewCard}>
      <View style={styles.uploadOverviewHeader}>
        <View>
          <Text style={styles.uploadOverviewLabel}>Latest upload period</Text>
          <Text style={styles.uploadOverviewTitle}>{uploadSummary.periodLabel}</Text>
        </View>
        <RiskPill label="Low" />
      </View>

      <Text style={styles.uploadOverviewDescription}>
        This dashboard assumes the business uploaded structured CSV sales records for the selected period. The app parses the data,
        stores it safely, then uses AI to generate pricing and risk insights.
      </Text>

      <View style={styles.uploadMetricGrid}>
        <InfoBadge label="Rows" value={String(uploadSummary.records)} color={palette.blue} />
        <InfoBadge label="Products" value={String(uploadSummary.products)} color={palette.cyan} />
        <InfoBadge label="Revenue" value={`€${Math.round(uploadSummary.totalRevenue / 1000)}k`} color={palette.green} />
        <InfoBadge label="Confidence" value={`${uploadSummary.avgConfidence}%`} color={palette.purple} />
      </View>
    </View>
  );
}

function StrategySelector({
  selected,
  onChange,
}: {
  selected: StrategyGoal;
  onChange: (goal: StrategyGoal) => void;
}) {
  const items: StrategyGoal[] = ['Balanced', 'Fast Sales', 'Max Profit'];

  return (
    <View style={styles.strategyWrap}>
      {items.map((item) => {
        const active = selected === item;
        return (
          <TouchableOpacity
            key={item}
            style={[styles.strategyItem, active && styles.strategyItemActive]}
            onPress={() => onChange(item)}
            activeOpacity={0.7}
          >
            <Text style={[styles.strategyItemText, active && styles.strategyItemTextActive]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RiskMeter({ score }: { score: number }) {
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animated, {
      toValue: score,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animated, score]);

  const widthAnim = animated.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const barColor = score < 40 ? palette.green : score < 70 ? palette.yellow : palette.red;

  return (
    <View style={styles.riskMeterWrap}>
      <View style={styles.riskMeterTrack}>
        <Animated.View style={[styles.riskMeterFill, { width: widthAnim, backgroundColor: barColor }]} />
      </View>
      <View style={styles.riskMeterLabels}>
        <Text style={styles.riskMeterLabel}>Low</Text>
        <Text style={styles.riskMeterLabel}>Medium</Text>
        <Text style={styles.riskMeterLabel}>High</Text>
      </View>
    </View>
  );
}

function ConfidenceOrb({ value }: { value: number }) {
  return (
    <View style={styles.confidenceOrbWrap}>
      <View style={styles.confidenceRing1} />
      <View style={styles.confidenceRing2} />
      <View style={styles.confidenceRing3} />
      <View style={styles.confidenceCore}>
        <Text style={styles.confidenceCoreValue}>{value}%</Text>
        <Text style={styles.confidenceCoreLabel}>Confidence</Text>
      </View>
    </View>
  );
}

function ProductCard({
  item,
  active,
  onPress,
  index = 0,
}: {
  item: ProductAnalytics;
  active: boolean;
  onPress: () => void;
  index?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <AnimatedCard delay={index * 50} style={{ marginBottom: 12 }}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          activeOpacity={0.92}
          style={[styles.productCard, active && styles.productCardActive]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={styles.productCardTopRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productMeta}>{item.category} • {item.sku}</Text>
            </View>
            <RiskPill label={item.risk} />
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>Current</Text>
              <Text style={styles.priceValue}>{formatCurrency(item.currentPrice)}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>Suggested</Text>
              <Text style={[styles.priceValue, { color: palette.blue }]}>{formatCurrency(item.suggestedPrice)}</Text>
            </View>
          </View>

          <View style={styles.productMiniGrid}>
            <View style={styles.productMiniCell}>
              <Text style={styles.productMiniLabel}>Demand</Text>
              <Text style={styles.productMiniValue}>{item.demandIndex}</Text>
            </View>
            <View style={styles.productMiniCell}>
              <Text style={styles.productMiniLabel}>Competition</Text>
              <Text style={styles.productMiniValue}>{item.competitionStrength}</Text>
            </View>
            <View style={styles.productMiniCell}>
              <Text style={styles.productMiniLabel}>Confidence</Text>
              <Text style={styles.productMiniValue}>{item.confidence}%</Text>
            </View>
            <View style={styles.productMiniCell}>
              <Text style={styles.productMiniLabel}>Stock</Text>
              <Text style={styles.productMiniValue}>{item.stockLevel}</Text>
            </View>
          </View>

          <View style={styles.productInsightBox}>
            <Text style={styles.productInsightText}>{item.aiNote}</Text>
          </View>

          <View style={styles.deltaRow}>
            <View style={styles.deltaItem}>
              <Text style={styles.deltaLabel}>Sales</Text>
              <Text style={[styles.deltaValue, { color: item.expectedSalesChange >= 0 ? palette.green : palette.red }]}>
                {item.expectedSalesChange >= 0 ? '+' : ''}{item.expectedSalesChange}%
              </Text>
            </View>
            <View style={styles.deltaItem}>
              <Text style={styles.deltaLabel}>Profit</Text>
              <Text style={[styles.deltaValue, { color: item.expectedProfitChange >= 0 ? palette.green : palette.red }]}>
                {item.expectedProfitChange >= 0 ? '+' : ''}{item.expectedProfitChange}%
              </Text>
            </View>
            <View style={styles.deltaItem}>
              <Text style={styles.deltaLabel}>Trend</Text>
              <Text style={[styles.deltaValue, { color: item.trend === 'up' ? palette.green : item.trend === 'down' ? palette.red : palette.text }]}>
                {trendArrow(item.trend)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </AnimatedCard>
  );
}

function ScenarioCard({
  item,
  active,
  onPress,
  index = 0,
}: {
  item: ScenarioPreview;
  active: boolean;
  onPress: () => void;
  index?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <AnimatedCard delay={index * 50}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handlePress}
          style={[styles.scenarioCard, active && styles.scenarioCardActive]}
          activeOpacity={0.92}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={styles.scenarioTopRow}>
            <Text style={styles.scenarioTitle}>{item.title}</Text>
            <RiskPill label={item.risk} />
          </View>
          <View style={styles.scenarioGrid}>
            <View style={styles.scenarioCell}>
              <Text style={styles.scenarioCellLabel}>Sales</Text>
              <Text style={[styles.scenarioCellValue, { color: item.expectedSalesChange >= 0 ? palette.green : palette.red }]}>
                {item.expectedSalesChange >= 0 ? '+' : ''}{item.expectedSalesChange}%
              </Text>
            </View>
            <View style={styles.scenarioCell}>
              <Text style={styles.scenarioCellLabel}>Profit</Text>
              <Text style={[styles.scenarioCellValue, { color: item.expectedProfitChange >= 0 ? palette.green : palette.red }]}>
                {item.expectedProfitChange >= 0 ? '+' : ''}{item.expectedProfitChange}%
              </Text>
            </View>
            <View style={styles.scenarioCell}>
              <Text style={styles.scenarioCellLabel}>Confidence</Text>
              <Text style={styles.scenarioCellValue}>{item.confidence}%</Text>
            </View>
          </View>
          <Text style={styles.scenarioNote}>{item.note}</Text>
        </TouchableOpacity>
      </Animated.View>
    </AnimatedCard>
  );
}

function RecommendationCard({ item, index = 0 }: { item: AIRecommendation; index?: number }) {
  const color = priorityColor(item.priority);
  return (
    <AnimatedCard delay={index * 50} style={{ marginBottom: 12 }}>
      <View style={styles.recommendationCard}>
        <View style={styles.recommendationTopRow}>
          <Text style={styles.recommendationTitle}>{item.title}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: `${color}18`, borderColor: `${color}55` }]}>
            <Text style={[styles.priorityText, { color }]}>{item.priority}</Text>
          </View>
        </View>
        <Text style={styles.recommendationTarget}>{item.target}</Text>
        <Text style={styles.recommendationDescription}>{item.description}</Text>
      </View>
    </AnimatedCard>
  );
}

function AlertCard({ item, index = 0 }: { item: AlertSignal; index?: number }) {
  return (
    <AnimatedCard delay={index * 50} style={{ marginBottom: 12 }}>
      <View style={[styles.alertCard, { borderColor: `${riskColor(item.level)}55` }]}>
        <View style={styles.alertTopRow}>
          <RiskPill label={item.level} />
          <Text style={styles.alertTime}>{item.timestamp}</Text>
        </View>
        <Text style={styles.alertTitle}>{item.title}</Text>
        <Text style={styles.alertMessage}>{item.message}</Text>
      </View>
    </AnimatedCard>
  );
}

function FeedCard({ item, index = 0 }: { item: FeedInsight; index?: number }) {
  return (
    <AnimatedCard delay={index * 50} style={{ marginBottom: 12 }}>
      <View style={styles.feedCard}>
        <Text style={styles.feedHeadline}>{item.headline}</Text>
        <Text style={styles.feedSummary}>{item.summary}</Text>
        <Text style={styles.feedImpact}>{item.impact}</Text>
      </View>
    </AnimatedCard>
  );
}

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const norm = values.map((v) => (v - min) / (max - min || 1));

  return (
    <View style={styles.miniBarsWrap}>
      {norm.map((n, index) => (
        <View
          key={`${index}-${n}`}
          style={[
            styles.miniBar,
            {
              height: 24 + n * 54,
              opacity: 0.45 + n * 0.55,
            },
          ]}
        />
      ))}
    </View>
  );
}

function AIQueryModal({
  visible,
  onClose,
  selectedProduct,
}: {
  visible: boolean;
  onClose: () => void;
  selectedProduct: ProductAnalytics | null;
}) {
  const [question, setQuestion] = useState('What price should I test next for this product?');
  const [thinking, setThinking] = useState(false);
  const [answer, setAnswer] = useState(
    'When Groq is connected, this modal can send structured product metrics and return a natural-language answer with recommended price changes and confidence.'
  );
  const modalAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, modalAnim]);

  const askAI = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setThinking(true);
      setTimeout(() => {
        setAnswer(
          `For ${selectedProduct?.name ?? 'this product'}, the safest next move is a controlled test between ${formatCurrency(
            (selectedProduct?.currentPrice ?? 0) * 1.03
          )} and ${formatCurrency((selectedProduct?.currentPrice ?? 0) * 1.06)}. The product currently shows ${selectedProduct?.risk?.toLowerCase() ?? 'medium'} risk with ${selectedProduct?.confidence ?? 0}% confidence.`
        );
        setThinking(false);
      }, 900);
    } catch {
      setThinking(false);
      Alert.alert('Error', 'Unable to generate response.');
    }
  };

  const translateY = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY }] }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Ask RiskLens AI</Text>
              <Text style={styles.modalSubtitle}>{selectedProduct?.name ?? 'Select a product'}</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={18} color={palette.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalInputWrap}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              multiline
              placeholder="Ask about price, demand, risk, or strategy"
              placeholderTextColor={palette.textMuted}
              style={styles.modalInput}
            />
          </View>

          <TouchableOpacity style={styles.modalPrimaryButton} onPress={askAI}>
            <LinearGradient colors={[palette.blue, palette.blue2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalPrimaryButtonGradient}>
              {thinking ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryButtonText}>Generate Insight</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.modalAnswerCard}>
            <Text style={styles.modalAnswerTitle}>AI Response</Text>
            <Text style={styles.modalAnswerText}>{answer}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function IndexScreen() {
  const [goal, setGoal] = useState<StrategyGoal>('Balanced');
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id ?? '');
  const [showAIModal, setShowAIModal] = useState(false);
  const [csvMode, setCsvMode] = useState(true);
  const [liveMonitoring, setLiveMonitoring] = useState(true);
  const [simulationMode, setSimulationMode] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.9)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.spring(fabAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [fabAnim, pulse]);

  const selectedProduct = useMemo(() => products.find((item) => item.id === selectedProductId) ?? products[0], [selectedProductId]);
  const selectedScenario = useMemo(() => scenarios.find((item) => item.id === selectedScenarioId) ?? scenarios[0], [selectedScenarioId]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const query = search.toLowerCase();
    return products.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
    );
  }, [search]);

  const heroRiskScore = selectedProduct.risk === 'Low' ? 28 : selectedProduct.risk === 'Medium' ? 57 : 81;

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setShowScrollTop(offsetY > 300);
      },
    }
  );

  const fabScale = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={palette.bg} />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.blue} />}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.topBar}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.eyebrow}>AI Pricing & Risk Intelligence</Text>
            <Text style={styles.mainTitle}>RiskLens Dashboard</Text>
            <Text style={styles.mainSubtitle}>
              Built for businesses that upload CSV sales data and want smart price recommendations, risk analysis, and what-if simulations.
            </Text>
          </View>
          <View style={styles.liveBadgeWrap}>
            <Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} />
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={palette.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search products, categories, SKUs"
            placeholderTextColor={palette.textMuted}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchButton}>
              <Ionicons name="close-circle" size={18} color={palette.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <StrategySelector selected={goal} onChange={setGoal} />

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={styles.heroEyebrow}>Current AI Recommendation</Text>
              <Text style={styles.heroTitle}>Best next price for {selectedProduct.name}</Text>
              <Text style={styles.heroText}>
                The goal of RiskLens is to transform uploaded sales data into structured intelligence. The AI layer should explain what happens when price moves up or down and how that affects demand, profit, and risk.
              </Text>
            </View>
            <View style={styles.heroPriceCard}>
              <Text style={styles.heroPriceLabel}>Suggested Price</Text>
              <Text style={styles.heroPriceValue}>{formatCurrency(selectedProduct.suggestedPrice)}</Text>
              <Text style={styles.heroPriceHint}>Current {formatCurrency(selectedProduct.currentPrice)}</Text>
            </View>
          </View>

          <View style={styles.heroStatGrid}>
            <SummaryChip icon="trending-down-outline" title="Expected Sales" value={`${selectedProduct.expectedSalesChange}%`} accent={selectedProduct.expectedSalesChange >= 0 ? palette.green : palette.red} />
            <SummaryChip icon="cash-outline" title="Expected Profit" value={`${selectedProduct.expectedProfitChange > 0 ? '+' : ''}${selectedProduct.expectedProfitChange}%`} accent={selectedProduct.expectedProfitChange >= 0 ? palette.green : palette.red} />
            <SummaryChip icon="warning-outline" title="Risk Level" value={selectedProduct.risk} accent={riskColor(selectedProduct.risk)} />
            <SummaryChip icon="shield-checkmark-outline" title="Confidence" value={`${selectedProduct.confidence}%`} accent={palette.purple} />
          </View>
        </View>

        <UploadOverviewCard />

        <SectionHeader title="Executive KPIs" subtitle="Fast summary generated from uploaded business data" />
        <FlatList
          data={dashboardKpis}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => <KPIWidget item={item} />}
          contentContainerStyle={styles.horizontalList}
        />

        <SectionHeader title="Risk & Confidence Center" subtitle="Core engine output for the selected product" />
        <View style={styles.dualPanelRow}>
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>Risk Exposure</Text>
            <Text style={styles.panelSubtitle}>Current modeled downside potential</Text>
            <View style={styles.bigScoreRow}>
              <Text style={styles.bigScoreValue}>{heroRiskScore}</Text>
              <Text style={styles.bigScoreUnit}>/100</Text>
            </View>
            <RiskMeter score={heroRiskScore} />
            <Text style={styles.panelNarrative}>
              {selectedProduct.risk === 'Low'
                ? 'This move looks relatively safe given current demand, price resilience, and competitive conditions.'
                : selectedProduct.risk === 'Medium'
                ? 'This product has upside, but demand response should be monitored after any change.'
                : 'This product is highly sensitive right now. Price movement should be tested carefully and incrementally.'}
            </Text>
          </View>

          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>Prediction Confidence</Text>
            <Text style={styles.panelSubtitle}>How reliable the model believes the output is</Text>
            <ConfidenceOrb value={selectedProduct.confidence} />
            <Text style={[styles.panelNarrative, { textAlign: 'center' }]}>Confidence grows when CSV uploads are consistent, structured, and rich in historical context.</Text>
          </View>
        </View>

        <SectionHeader title="What-If Scenarios" subtitle="Test different price movements before rollout" action="Ask AI" onPress={() => setShowAIModal(true)} />
        <View style={styles.scenarioWrap}>
          {scenarios.map((scenario, idx) => (
            <ScenarioCard
              key={scenario.id}
              item={scenario}
              active={selectedScenarioId === scenario.id}
              onPress={() => setSelectedScenarioId(scenario.id)}
              index={idx}
            />
          ))}
        </View>

        <View style={styles.scenarioSummaryCard}>
          <Text style={styles.scenarioSummaryTitle}>Selected Scenario</Text>
          <Text style={styles.scenarioSummaryText}>
            {selectedScenario.title} is modeled as {selectedScenario.risk.toLowerCase()} risk with {selectedScenario.confidence}% confidence. {selectedScenario.note}
          </Text>
        </View>

        <SectionHeader title="Products in Focus" subtitle="Products parsed from business sales records and analyzed by the pricing engine" />
        {filteredProducts.map((item, idx) => (
          <ProductCard key={item.id} item={item} active={item.id === selectedProductId} onPress={() => setSelectedProductId(item.id)} index={idx} />
        ))}

        <SectionHeader title="AI Recommendations" subtitle="Priority actions the system should generate after CSV analysis" />
        {recommendations.map((item, idx) => (
          <RecommendationCard key={item.id} item={item} index={idx} />
        ))}

        <SectionHeader title="Market Pulse" subtitle="Quick pattern view across momentum, seasonality, and pressure" />
        <View style={styles.marketPulseRow}>
          <View style={styles.marketLargeCard}>
            <Text style={styles.panelTitle}>Demand Momentum</Text>
            <Text style={styles.panelSubtitle}>Based on the latest upload windows</Text>
            <MiniBars values={[22, 28, 33, 40, 38, 51, 55, 63]} />
            <Text style={styles.panelNarrative}>Demand quality is improving for the strongest products, creating safer room for controlled price increases.</Text>
          </View>
          <View style={styles.marketSmallColumn}>
            <View style={styles.marketSmallCard}>
              <Text style={styles.panelTitle}>Competition Pressure</Text>
              <Text style={styles.marketNumber}>64</Text>
              <Text style={styles.marketLabel}>Moderate</Text>
            </View>
            <View style={styles.marketSmallCard}>
              <Text style={styles.panelTitle}>Seasonality Signal</Text>
              <Text style={styles.marketNumber}>+18%</Text>
              <Text style={styles.marketLabel}>Above baseline</Text>
            </View>
          </View>
        </View>

        <SectionHeader title="Insight Feed" subtitle="Narrative AI-ready insights built on structured data" />
        {feed.map((item, idx) => (
          <FeedCard key={item.id} item={item} index={idx} />
        ))}

        <SectionHeader title="Alerts & Safety Signals" subtitle="Events that deserve immediate attention" />
        {alerts.map((item, idx) => (
          <AlertCard key={item.id} item={item} index={idx} />
        ))}

        <SectionHeader title="System Controls" subtitle="Toggles for how the product should behave when Groq and Supabase are connected" />
        <View style={styles.controlCard}>
          <View style={styles.controlRow}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={styles.controlTitle}>CSV analysis mode</Text>
              <Text style={styles.controlText}>Use uploaded datasets as the main source for dashboard insights.</Text>
            </View>
            <Switch value={csvMode} onValueChange={setCsvMode} trackColor={{ false: '#324864', true: '#2D62AF' }} />
          </View>
        </View>
        <View style={styles.controlCard}>
          <View style={styles.controlRow}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={styles.controlTitle}>Live monitoring</Text>
              <Text style={styles.controlText}>Continuously highlight products with changing risk or competitive pressure.</Text>
            </View>
            <Switch value={liveMonitoring} onValueChange={setLiveMonitoring} trackColor={{ false: '#324864', true: '#2D62AF' }} />
          </View>
        </View>
        <View style={styles.controlCard}>
          <View style={styles.controlRow}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={styles.controlTitle}>Simulation mode</Text>
              <Text style={styles.controlText}>Enable what-if experimentation directly from the dashboard.</Text>
            </View>
            <Switch value={simulationMode} onValueChange={setSimulationMode} trackColor={{ false: '#324864', true: '#2D62AF' }} />
          </View>
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>How this should evolve next</Text>
          <Text style={styles.footerText}>
            Next, this screen should connect to Supabase user data, read uploaded CSV files, parse sales records into structured rows,
            and send prepared business summaries to Groq for AI recommendations, risk scoring, and interactive Q&A.
          </Text>
        </View>
      </ScrollView>

      <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setShowAIModal(true);
          }}
          activeOpacity={0.85}
        >
          <LinearGradient colors={[palette.blue, palette.blue2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {showScrollTop && (
        <Animated.View style={[styles.scrollTopButton, { opacity: scrollY.interpolate({ inputRange: [300, 400], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
          <TouchableOpacity onPress={scrollToTop} style={styles.scrollTopInner} activeOpacity={0.8}>
            <Ionicons name="arrow-up" size={20} color={palette.text} />
          </TouchableOpacity>
        </Animated.View>
      )}

      <AIQueryModal visible={showAIModal} onClose={() => setShowAIModal(false)} selectedProduct={selectedProduct} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  eyebrow: {
    color: palette.cyan,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  mainTitle: {
    color: palette.text,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  mainSubtitle: {
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: width * 0.72,
  },
  liveBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.chip2,
    borderWidth: 0.5,
    borderColor: palette.border,
    marginTop: 6,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.green,
    marginRight: 8,
  },
  liveBadgeText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 13,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.panel,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    marginLeft: 10,
  },
  clearSearchButton: {
    padding: 4,
  },
  strategyWrap: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  strategyItem: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: palette.panel,
    borderWidth: 0.5,
    borderColor: palette.border,
    alignItems: 'center',
  },
  strategyItemActive: {
    backgroundColor: palette.panel2,
    borderColor: palette.blue,
  },
  strategyItemText: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  strategyItemTextActive: {
    color: palette.blue,
  },
  heroCard: {
    backgroundColor: palette.panel,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  heroEyebrow: {
    color: palette.cyan,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: palette.text,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 31,
    marginBottom: 10,
  },
  heroText: {
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 22,
  },
  heroPriceCard: {
    width: 145,
    borderRadius: 22,
    backgroundColor: palette.chip2,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 14,
    justifyContent: 'center',
  },
  heroPriceLabel: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  heroPriceValue: {
    color: palette.text,
    fontSize: 25,
    fontWeight: '900',
  },
  heroPriceHint: {
    color: palette.blue,
    fontSize: 12,
    marginTop: 8,
    fontWeight: '700',
  },
  heroStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryChip: {
    width: (width - 36 - 10) / 2,
    backgroundColor: palette.chip2,
    borderWidth: 0.5,
    borderColor: palette.border,
    borderRadius: 20,
    padding: 14,
  },
  summaryChipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  summaryChipTitle: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  summaryChipValue: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  uploadOverviewCard: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 18,
    marginBottom: 16,
  },
  uploadOverviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadOverviewLabel: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  uploadOverviewTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  uploadOverviewDescription: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 14,
  },
  uploadMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoBadge: {
    minWidth: 94,
    borderWidth: 0.5,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoBadgeLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  infoBadgeValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 8,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.chip2,
    borderWidth: 0.5,
    borderColor: palette.border,
  },
  sectionActionText: {
    color: palette.blue,
    fontWeight: '700',
    fontSize: 12,
  },
  horizontalList: {
    paddingBottom: 6,
  },
  kpiWidget: {
    width: width * 0.68,
    backgroundColor: palette.panel,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 18,
    marginRight: 12,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiDeltaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  kpiDeltaText: {
    fontWeight: '800',
    fontSize: 12,
  },
  kpiLabel: {
    color: palette.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  kpiValue: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '900',
  },
  dualPanelRow: {
    gap: 12,
    marginBottom: 8,
  },
  panelCard: {
    backgroundColor: palette.panel,
    borderRadius: 26,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 18,
  },
  panelTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  panelSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  bigScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 12,
  },
  bigScoreValue: {
    color: palette.text,
    fontSize: 46,
    fontWeight: '900',
    lineHeight: 50,
  },
  bigScoreUnit: {
    color: palette.textMuted,
    fontSize: 18,
    marginLeft: 6,
    marginBottom: 6,
  },
  riskMeterWrap: {
    marginBottom: 14,
  },
  riskMeterTrack: {
    height: 16,
    borderRadius: 999,
    backgroundColor: palette.chip2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  riskMeterFill: {
    height: '100%',
    borderRadius: 999,
  },
  riskMeterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  riskMeterLabel: {
    color: palette.textMuted,
    fontSize: 12,
  },
  panelNarrative: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 21,
  },
  confidenceOrbWrap: {
    marginVertical: 18,
    alignSelf: 'center',
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confidenceRing1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 0.5,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  confidenceRing2: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 0.5,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  confidenceRing3: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 0.5,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  confidenceCore: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: palette.panel3,
    borderWidth: 0.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confidenceCoreValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  confidenceCoreLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  scenarioWrap: {
    gap: 10,
  },
  scenarioCard: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 16,
  },
  scenarioCardActive: {
    backgroundColor: palette.panel2,
    borderColor: palette.blue,
  },
  scenarioTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  scenarioTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    paddingRight: 10,
  },
  scenarioGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scenarioCell: {
    flex: 1,
  },
  scenarioCellLabel: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  scenarioCellValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  scenarioNote: {
    color: palette.blue,
    fontSize: 13,
    fontWeight: '600',
  },
  scenarioSummaryCard: {
    backgroundColor: palette.panel2,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 16,
    marginTop: 12,
    marginBottom: 18,
  },
  scenarioSummaryTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  scenarioSummaryText: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  productCard: {
    backgroundColor: palette.panel,
    borderRadius: 26,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 18,
    marginBottom: 12,
  },
  productCardActive: {
    backgroundColor: palette.panel2,
    borderColor: palette.blue,
    shadowColor: palette.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  productCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  productName: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  productMeta: {
    color: palette.textMuted,
    fontSize: 13,
  },
  riskPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 0.5,
  },
  riskPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    backgroundColor: palette.chip2,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
  },
  priceBlock: {
    flex: 1,
  },
  priceLabel: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  priceValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  priceDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: palette.border,
    marginHorizontal: 14,
  },
  productMiniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  productMiniCell: {
    minWidth: 78,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.chip2,
    borderWidth: 0.5,
    borderColor: palette.border,
  },
  productMiniLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  productMiniValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  productInsightBox: {
    borderRadius: 18,
    backgroundColor: palette.chip2,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 14,
    marginBottom: 14,
  },
  productInsightText: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 21,
  },
  deltaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  deltaItem: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: palette.chip2,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 12,
  },
  deltaLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginBottom: 6,
  },
  deltaValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  recommendationCard: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 12,
  },
  recommendationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
  },
  recommendationTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 0.5,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '800',
  },
  recommendationTarget: {
    color: palette.blue,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  recommendationDescription: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 21,
  },
  marketPulseRow: {
    gap: 12,
    marginBottom: 8,
  },
  marketLargeCard: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 18,
  },
  miniBarsWrap: {
    height: 92,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginVertical: 18,
  },
  miniBar: {
    width: 24,
    borderRadius: 12,
    backgroundColor: palette.blue,
  },
  marketSmallColumn: {
    flexDirection: 'row',
    gap: 12,
  },
  marketSmallCard: {
    flex: 1,
    backgroundColor: palette.panel,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 18,
  },
  marketNumber: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 10,
  },
  marketLabel: {
    color: palette.textSoft,
    fontSize: 13,
  },
  feedCard: {
    backgroundColor: palette.panel2,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 12,
  },
  feedHeadline: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  feedSummary: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 10,
  },
  feedImpact: {
    color: palette.cyan,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  alertCard: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 0.5,
    padding: 16,
    marginBottom: 12,
  },
  alertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertTime: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  alertTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  alertMessage: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 21,
  },
  controlCard: {
    backgroundColor: palette.panel,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 12,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  controlText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: width * 0.62,
  },
  footerCard: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 20,
    alignItems: 'center',
  },
  footerTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  footerText: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalSheet: {
    backgroundColor: palette.bg2,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 0.5,
    borderColor: palette.border,
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 24,
    minHeight: height * 0.58,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 58,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.chip2,
    borderWidth: 0.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInputWrap: {
    backgroundColor: palette.panel,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 12,
    marginBottom: 14,
  },
  modalInput: {
    color: palette.text,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalPrimaryButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
  },
  modalPrimaryButtonGradient: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  modalAnswerCard: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: palette.border,
    padding: 16,
  },
  modalAnswerTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalAnswerText: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 21,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 999,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollTopButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 999,
  },
  scrollTopInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.panel2,
    borderWidth: 0.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});