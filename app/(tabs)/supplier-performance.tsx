import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type DimensionValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import AppSidebar from '../../components/appsidebar';

const palette = {
  bg: '#F5F7F3',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF3EC',
  surfaceSoft2: '#E6EEE5',
  border: '#D7E1D3',
  borderStrong: '#C7D4C3',

  text: '#132118',
  textSoft: '#425345',
  textMuted: '#728173',

  primary: '#183C2A',
  primary2: '#24583D',
  primary3: '#2F7A51',

  danger: '#D94F4F',
  warning: '#C98A1F',
  success: '#2D8A57',
  info: '#4475D9',
  purple: '#8B5CF6',
  cyan: '#06B6D4',

  redSoft: '#FFF1F1',
  yellowSoft: '#FFF8E8',
  greenSoft: '#EDF8F0',
  blueSoft: '#EDF3FF',
  purpleSoft: '#F3EEFF',
  cyanSoft: '#E9FCFF',
};

type ProductRow = {
  id: string;
  name: string;
  category?: string | null;
  stock_quantity?: number | null;
  min_stock_level?: number | null;
  selling_price?: number | null;
  cost_price?: number | null;
  expiry_date?: string | null;
  supplier_name?: string | null;
};

type SupplierScore = {
  supplier: string;
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  nearExpiryCount: number;
  expiredCount: number;
  weakMarginCount: number;
  highRiskCount: number;
  healthyCount: number;
  totalInventoryCost: number;
  totalPotentialRevenue: number;
  avgMargin: number;
  reliabilityScore: number;
  efficiencyScore: number;
  pressureScore: number;
};

function safeNumber(value?: number | null) {
  return Number(value || 0);
}

function formatCurrency(value?: number | null) {
  return `€${safeNumber(value).toFixed(2)}`;
}

function formatCompactCurrency(value?: number | null) {
  const n = safeNumber(value);
  if (n >= 1000000) return `€${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${n.toFixed(0)}`;
}

function marginPercent(selling?: number | null, cost?: number | null) {
  const s = safeNumber(selling);
  const c = safeNumber(cost);
  if (s <= 0) return 0;
  return ((s - c) / s) * 100;
}

function daysUntil(dateString?: string | null) {
  if (!dateString) return null;
  const today = new Date();
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return null;

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function riskScore(item: ProductRow) {
  const stock = safeNumber(item.stock_quantity);
  const minStock = safeNumber(item.min_stock_level);
  const expiry = daysUntil(item.expiry_date);
  const margin = marginPercent(item.selling_price, item.cost_price);

  let score = 0;

  if (expiry !== null) {
    if (expiry < 0) score += 50;
    else if (expiry <= 2) score += 35;
    else if (expiry <= 5) score += 25;
    else if (expiry <= 7) score += 15;
  }

  if (minStock > 0 && stock <= minStock) score += 20;
  if (stock <= 0) score += 25;
  if (margin < 10) score += 15;
  else if (margin < 15) score += 8;

  return Math.min(100, score);
}

function scoreTone(score: number) {
  if (score >= 80) return { label: 'Strong', color: palette.success, bg: palette.greenSoft };
  if (score >= 60) return { label: 'Stable', color: palette.info, bg: palette.blueSoft };
  if (score >= 40) return { label: 'Watch', color: palette.warning, bg: palette.yellowSoft };
  return { label: 'Weak', color: palette.danger, bg: palette.redSoft };
}

function Bar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const widthPercent: DimensionValue = max > 0 ? `${(value / max) * 100}%` : '0%';

  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: widthPercent, backgroundColor: color }]} />
    </View>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      {!!eyebrow && <Text style={styles.sectionEyebrow}>{eyebrow}</Text>}
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  tone = 'green',
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'cyan';
}) {
  const bgMap = {
    green: palette.greenSoft,
    yellow: palette.yellowSoft,
    red: palette.redSoft,
    blue: palette.blueSoft,
    purple: palette.purpleSoft,
    cyan: palette.cyanSoft,
  } as const;

  const colorMap = {
    green: palette.success,
    yellow: palette.warning,
    red: palette.danger,
    blue: palette.info,
    purple: palette.purple,
    cyan: palette.cyan,
  } as const;

  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIconWrap, { backgroundColor: bgMap[tone] }]}>
        <Ionicons name={icon} size={18} color={colorMap[tone]} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function SupplierPerformanceScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const loadProducts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('food_products')
        .select(
          'id, name, category, stock_quantity, min_stock_level, selling_price, cost_price, expiry_date, supplier_name'
        )
        .eq('user_id', user.id);

      if (error) throw error;

      setProducts((data as ProductRow[]) || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const supplierScores = useMemo(() => {
    const map = new Map<string, SupplierScore>();

    for (const product of products) {
      const supplier = product.supplier_name?.trim() || 'Unknown Supplier';
      const stock = safeNumber(product.stock_quantity);
      const minStock = safeNumber(product.min_stock_level);
      const margin = marginPercent(product.selling_price, product.cost_price);
      const expiry = daysUntil(product.expiry_date);
      const risk = riskScore(product);

      const current = map.get(supplier) || {
        supplier,
        productCount: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        nearExpiryCount: 0,
        expiredCount: 0,
        weakMarginCount: 0,
        highRiskCount: 0,
        healthyCount: 0,
        totalInventoryCost: 0,
        totalPotentialRevenue: 0,
        avgMargin: 0,
        reliabilityScore: 0,
        efficiencyScore: 0,
        pressureScore: 0,
      };

      current.productCount += 1;
      current.totalInventoryCost += stock * safeNumber(product.cost_price);
      current.totalPotentialRevenue += stock * safeNumber(product.selling_price);
      current.avgMargin += margin;

      const lowStock = minStock > 0 ? stock <= minStock : stock <= 10;
      const outOfStock = stock <= 0;
      const nearExpiry = expiry !== null && expiry >= 0 && expiry <= 7;
      const expired = expiry !== null && expiry < 0;
      const weakMargin = margin < 15;
      const highRisk = risk >= 70;

      if (lowStock) current.lowStockCount += 1;
      if (outOfStock) current.outOfStockCount += 1;
      if (nearExpiry) current.nearExpiryCount += 1;
      if (expired) current.expiredCount += 1;
      if (weakMargin) current.weakMarginCount += 1;
      if (highRisk) current.highRiskCount += 1;
      if (!lowStock && !nearExpiry && !expired && !weakMargin && risk < 40) {
        current.healthyCount += 1;
      }

      map.set(supplier, current);
    }

    return Array.from(map.values())
      .map((item) => {
        const avgMargin = item.productCount ? item.avgMargin / item.productCount : 0;

        const pressureScore = Math.min(
          100,
          item.outOfStockCount * 18 +
            item.expiredCount * 18 +
            item.nearExpiryCount * 10 +
            item.lowStockCount * 8 +
            item.weakMarginCount * 6 +
            item.highRiskCount * 12
        );

        const reliabilityScore = Math.max(
          0,
          Math.min(
            100,
            100 -
              item.outOfStockCount * 15 -
              item.expiredCount * 15 -
              item.nearExpiryCount * 8 -
              item.highRiskCount * 10
          )
        );

        const efficiencyScore = Math.max(
          0,
          Math.min(
            100,
            avgMargin * 2 +
              item.healthyCount * 6 -
              item.weakMarginCount * 5 -
              item.outOfStockCount * 5
          )
        );

        return {
          ...item,
          avgMargin,
          pressureScore,
          reliabilityScore,
          efficiencyScore,
        };
      })
      .sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  }, [products]);

  const overview = useMemo(() => {
    const totalSuppliers = supplierScores.length;
    const highPressureSuppliers = supplierScores.filter((s) => s.pressureScore >= 50).length;
    const weakSuppliers = supplierScores.filter((s) => s.reliabilityScore < 50).length;

    const totalInventoryCost = supplierScores.reduce(
      (sum, s) => sum + safeNumber(s.totalInventoryCost),
      0
    );
    const totalPotentialRevenue = supplierScores.reduce(
      (sum, s) => sum + safeNumber(s.totalPotentialRevenue),
      0
    );

    const avgReliability =
      supplierScores.length > 0
        ? supplierScores.reduce((sum, s) => sum + s.reliabilityScore, 0) / supplierScores.length
        : 0;

    const avgEfficiency =
      supplierScores.length > 0
        ? supplierScores.reduce((sum, s) => sum + s.efficiencyScore, 0) / supplierScores.length
        : 0;

    return {
      totalSuppliers,
      highPressureSuppliers,
      weakSuppliers,
      totalInventoryCost,
      totalPotentialRevenue,
      avgReliability,
      avgEfficiency,
    };
  }, [supplierScores]);

  const maxReliability = Math.max(...supplierScores.map((s) => s.reliabilityScore), 1);
  const maxPressure = Math.max(...supplierScores.map((s) => s.pressureScore), 1);

  const topReliable = useMemo(() => {
    return [...supplierScores].sort((a, b) => b.reliabilityScore - a.reliabilityScore).slice(0, 5);
  }, [supplierScores]);

  const mostPressure = useMemo(() => {
    return [...supplierScores].sort((a, b) => b.pressureScore - a.pressureScore).slice(0, 5);
  }, [supplierScores]);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadProducts(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading supplier performance...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.pageWrap}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.primary2}
            />
          }
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
                  <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#fff" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>Supply intelligence</Text>
                  <Text style={styles.heroTitle}>Supplier Performance</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.heroButton}
                onPress={() => router.push('/(tabs)/products')}
              >
                <Ionicons name="cube-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.heroSubtitle}>
              Compare supplier reliability, stock pressure, expiry exposure, margin health
              and overall operational performance across your inventory.
            </Text>

            <View style={styles.heroInsightBand}>
              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Suppliers</Text>
                <Text style={styles.heroInsightValue}>{overview.totalSuppliers}</Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Avg reliability</Text>
                <Text style={styles.heroInsightValue}>{Math.round(overview.avgReliability)}%</Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>High pressure</Text>
                <Text style={styles.heroInsightValue}>{overview.highPressureSuppliers}</Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Overview"
            title="Supplier landscape"
            subtitle="A quick reading of supplier strength, exposure and operational quality."
          />

          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Suppliers"
              value={`${overview.totalSuppliers}`}
              subtitle="Tracked supply partners"
              icon="people-outline"
              tone="green"
            />
            <SummaryCard
              title="High pressure"
              value={`${overview.highPressureSuppliers}`}
              subtitle="Need urgent attention"
              icon="warning-outline"
              tone="red"
            />
            <SummaryCard
              title="Weak suppliers"
              value={`${overview.weakSuppliers}`}
              subtitle="Reliability under 50%"
              icon="trending-down-outline"
              tone="yellow"
            />
            <SummaryCard
              title="Avg efficiency"
              value={`${Math.round(overview.avgEfficiency)}%`}
              subtitle="Margin and stability mix"
              icon="analytics-outline"
              tone="blue"
            />
            <SummaryCard
              title="Inventory cost"
              value={formatCompactCurrency(overview.totalInventoryCost)}
              subtitle="Current cost exposure"
              icon="wallet-outline"
              tone="purple"
            />
            <SummaryCard
              title="Potential revenue"
              value={formatCompactCurrency(overview.totalPotentialRevenue)}
              subtitle="Supplier-linked revenue"
              icon="cash-outline"
              tone="cyan"
            />
          </View>

          <SectionHeader
            eyebrow="Leaders"
            title="Most reliable suppliers"
            subtitle="Suppliers with the strongest consistency and lowest operational risk."
          />

          <View style={styles.cardBlock}>
            {topReliable.length > 0 ? (
              topReliable.map((supplier) => {
                const tone = scoreTone(supplier.reliabilityScore);

                return (
                  <View key={supplier.supplier} style={styles.insightRowCard}>
                    <View style={styles.insightRowTop}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={styles.insightRowTitle}>{supplier.supplier}</Text>
                        <Text style={styles.insightRowSubtitle}>
                          {supplier.productCount} products • {supplier.healthyCount} healthy
                        </Text>
                      </View>

                      <View style={[styles.scoreBadge, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.scoreBadgeText, { color: tone.color }]}>
                          {tone.label}
                        </Text>
                      </View>
                    </View>

                    <Bar
                      value={supplier.reliabilityScore}
                      max={maxReliability}
                      color={palette.success}
                    />

                    <View style={styles.metricRow}>
                      <Text style={styles.metricText}>
                        Reliability {supplier.reliabilityScore.toFixed(0)}%
                      </Text>
                      <Text style={styles.metricText}>
                        Efficiency {supplier.efficiencyScore.toFixed(0)}%
                      </Text>
                      <Text style={styles.metricText}>
                        Margin {supplier.avgMargin.toFixed(0)}%
                      </Text>
                      <Text style={styles.metricText}>
                        Revenue {formatCompactCurrency(supplier.totalPotentialRevenue)}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No supplier data yet</Text>
                <Text style={styles.emptySubtitle}>
                  Upload products with supplier names to unlock performance analytics.
                </Text>
              </View>
            )}
          </View>

          <SectionHeader
            eyebrow="Pressure"
            title="Suppliers under stress"
            subtitle="Suppliers most associated with stock, expiry and risk pressure."
          />

          <View style={styles.cardBlock}>
            {mostPressure.length > 0 ? (
              mostPressure.map((supplier) => (
                <View key={supplier.supplier} style={styles.insightRowCard}>
                  <View style={styles.insightRowTop}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.insightRowTitle}>{supplier.supplier}</Text>
                      <Text style={styles.insightRowSubtitle}>
                        {supplier.lowStockCount} low stock • {supplier.nearExpiryCount} near expiry
                      </Text>
                    </View>
                    <Text style={styles.insightRowValue}>
                      Pressure {supplier.pressureScore.toFixed(0)}%
                    </Text>
                  </View>

                  <Bar
                    value={supplier.pressureScore}
                    max={maxPressure}
                    color={palette.danger}
                  />

                  <View style={styles.metricRow}>
                    <Text style={styles.metricText}>
                      High risk {supplier.highRiskCount}
                    </Text>
                    <Text style={styles.metricText}>
                      Out of stock {supplier.outOfStockCount}
                    </Text>
                    <Text style={styles.metricText}>
                      Expired {supplier.expiredCount}
                    </Text>
                    <Text style={styles.metricText}>
                      Weak margin {supplier.weakMarginCount}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No pressure data yet</Text>
                <Text style={styles.emptySubtitle}>
                  Supplier pressure will appear once product inventory is available.
                </Text>
              </View>
            )}
          </View>

          <SectionHeader
            eyebrow="Full ranking"
            title="All suppliers ranked"
            subtitle="Compare supplier scores side by side."
          />

          <View style={styles.cardBlock}>
            {supplierScores.length > 0 ? (
              supplierScores.map((supplier) => (
                <View key={supplier.supplier} style={styles.rankCard}>
                  <View style={styles.rankTopRow}>
                    <View style={styles.rankLeft}>
                      <View style={styles.rankIconWrap}>
                        <MaterialCommunityIcons
                          name="factory"
                          size={18}
                          color={palette.primary2}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rankTitle}>{supplier.supplier}</Text>
                        <Text style={styles.rankSubtitle}>
                          {supplier.productCount} products • margin {supplier.avgMargin.toFixed(0)}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.rankRight}>
                      <Text style={styles.rankPrimaryScore}>
                        {supplier.reliabilityScore.toFixed(0)}%
                      </Text>
                      <Text style={styles.rankPrimaryLabel}>reliability</Text>
                    </View>
                  </View>

                  <View style={styles.rankMetricsGrid}>
                    <View style={styles.rankMetricBox}>
                      <Text style={styles.rankMetricValue}>{supplier.efficiencyScore.toFixed(0)}%</Text>
                      <Text style={styles.rankMetricLabel}>Efficiency</Text>
                    </View>
                    <View style={styles.rankMetricBox}>
                      <Text style={styles.rankMetricValue}>{supplier.pressureScore.toFixed(0)}%</Text>
                      <Text style={styles.rankMetricLabel}>Pressure</Text>
                    </View>
                    <View style={styles.rankMetricBox}>
                      <Text style={styles.rankMetricValue}>{supplier.healthyCount}</Text>
                      <Text style={styles.rankMetricLabel}>Healthy</Text>
                    </View>
                    <View style={styles.rankMetricBox}>
                      <Text style={styles.rankMetricValue}>{supplier.highRiskCount}</Text>
                      <Text style={styles.rankMetricLabel}>High risk</Text>
                    </View>
                  </View>

                  <View style={styles.rankBottomRow}>
                    <Text style={styles.rankBottomText}>
                      Inventory {formatCompactCurrency(supplier.totalInventoryCost)}
                    </Text>
                    <Text style={styles.rankBottomText}>
                      Revenue {formatCompactCurrency(supplier.totalPotentialRevenue)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No suppliers available</Text>
                <Text style={styles.emptySubtitle}>
                  Add products with supplier names to populate rankings.
                </Text>
              </View>
            )}
          </View>

          <SectionHeader
            eyebrow="Interpretation"
            title="What this means"
            subtitle="A short narrative reading of supplier performance."
          />

          <View style={styles.summaryNarrativeCard}>
            <Text style={styles.summaryNarrativeText}>
              {overview.totalSuppliers > 0
                ? `You currently track ${overview.totalSuppliers} suppliers. `
                : 'You currently do not track any suppliers. '}
              {overview.highPressureSuppliers > 0
                ? `${overview.highPressureSuppliers} suppliers are showing meaningful operational pressure through expiry, stock or risk exposure. `
                : 'No suppliers are currently under major pressure. '}
              {overview.weakSuppliers > 0
                ? `${overview.weakSuppliers} suppliers have weak reliability and should be reviewed first. `
                : 'Supplier reliability currently looks stable. '}
              Inventory tied to suppliers is valued at {formatCurrency(overview.totalInventoryCost)}, while potential revenue stands near {formatCurrency(overview.totalPotentialRevenue)}.
            </Text>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>

        <AppSidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          active="supplier-performance"
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bg,
  },
  loadingText: {
    marginTop: 14,
    color: palette.textSoft,
    fontSize: 14,
    fontWeight: '600',
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },

  hero: {
    borderRadius: 30,
    padding: 20,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
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
  heroButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  heroInsightBand: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroInsightItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroInsightLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  heroInsightValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  heroDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 8,
  },

  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: palette.primary2,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  summaryCard: {
    width: '48.2%',
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  summaryTitle: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  summarySubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    fontWeight: '500',
  },

  cardBlock: {
    gap: 12,
    marginBottom: 18,
  },
  insightRowCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  insightRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  insightRowTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
  },
  insightRowSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 4,
  },
  insightRowValue: {
    color: palette.textSoft,
    fontSize: 13,
    fontWeight: '800',
  },
  scoreBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },

  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },

  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricText: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },

  rankCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  rankTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  rankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  rankIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  rankSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  rankRight: {
    alignItems: 'flex-end',
  },
  rankPrimaryScore: {
    color: palette.primary2,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  rankPrimaryLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  rankMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  rankMetricBox: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: palette.surfaceSoft,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  rankMetricValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  rankMetricLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  rankBottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  rankBottomText: {
    color: palette.textSoft,
    fontSize: 12,
    fontWeight: '700',
  },

  summaryNarrativeCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
  },
  summaryNarrativeText: {
    color: palette.textSoft,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },

  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: palette.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    fontWeight: '500',
  },
});