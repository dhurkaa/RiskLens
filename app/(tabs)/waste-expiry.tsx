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

type WasteProduct = ProductRow & {
  expiryDays: number | null;
  costExposure: number;
  revenueExposure: number;
  wasteRiskScore: number;
};

type CategoryWaste = {
  category: string;
  productCount: number;
  expiredCount: number;
  urgentCount: number;
  nearExpiryCount: number;
  totalCostExposure: number;
  totalRevenueExposure: number;
  avgRisk: number;
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

function expiryLabel(days: number | null) {
  if (days === null) return 'No expiry';
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days left`;
}

function wasteRiskScore(product: ProductRow) {
  const stock = safeNumber(product.stock_quantity);
  const cost = safeNumber(product.cost_price);
  const expiry = daysUntil(product.expiry_date);

  let score = 0;

  if (expiry !== null) {
    if (expiry < 0) score += 60;
    else if (expiry <= 1) score += 45;
    else if (expiry <= 3) score += 32;
    else if (expiry <= 7) score += 20;
    else if (expiry <= 14) score += 8;
  }

  if (stock >= 20) score += 18;
  else if (stock >= 10) score += 10;
  else if (stock >= 5) score += 5;

  if (cost >= 10) score += 10;
  else if (cost >= 5) score += 6;
  else if (cost >= 2) score += 3;

  return Math.min(100, score);
}

function riskTone(score: number) {
  if (score >= 70) return { label: 'Critical', color: palette.danger, bg: palette.redSoft };
  if (score >= 45) return { label: 'High', color: palette.warning, bg: palette.yellowSoft };
  if (score >= 20) return { label: 'Moderate', color: palette.info, bg: palette.blueSoft };
  return { label: 'Low', color: palette.success, bg: palette.greenSoft };
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

export default function WasteExpiryScreen() {
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

  const wasteProducts = useMemo<WasteProduct[]>(() => {
    return products
      .map((product) => {
        const stock = safeNumber(product.stock_quantity);
        const cost = safeNumber(product.cost_price);
        const sell = safeNumber(product.selling_price);
        const expiryDays = daysUntil(product.expiry_date);
        const costExposure = stock * cost;
        const revenueExposure = stock * sell;
        const risk = wasteRiskScore(product);

        return {
          ...product,
          expiryDays,
          costExposure,
          revenueExposure,
          wasteRiskScore: risk,
        };
      })
      .sort((a, b) => b.wasteRiskScore - a.wasteRiskScore);
  }, [products]);

  const overview = useMemo(() => {
    const expired = wasteProducts.filter((p) => p.expiryDays !== null && p.expiryDays < 0);
    const urgent = wasteProducts.filter((p) => p.expiryDays !== null && p.expiryDays >= 0 && p.expiryDays <= 2);
    const nearExpiry = wasteProducts.filter((p) => p.expiryDays !== null && p.expiryDays >= 0 && p.expiryDays <= 7);
    const next14Days = wasteProducts.filter((p) => p.expiryDays !== null && p.expiryDays >= 0 && p.expiryDays <= 14);

    const wasteExposureCost = nearExpiry.reduce((sum, p) => sum + p.costExposure, 0);
    const wasteExposureRevenue = nearExpiry.reduce((sum, p) => sum + p.revenueExposure, 0);
    const expiredCost = expired.reduce((sum, p) => sum + p.costExposure, 0);

    return {
      totalTracked: wasteProducts.length,
      expiredCount: expired.length,
      urgentCount: urgent.length,
      nearExpiryCount: nearExpiry.length,
      next14DaysCount: next14Days.length,
      wasteExposureCost,
      wasteExposureRevenue,
      expiredCost,
    };
  }, [wasteProducts]);

  const categoryWaste = useMemo<CategoryWaste[]>(() => {
    const map = new Map<string, CategoryWaste>();

    for (const product of wasteProducts) {
      const category = product.category?.trim() || 'Uncategorized';

      const current = map.get(category) || {
        category,
        productCount: 0,
        expiredCount: 0,
        urgentCount: 0,
        nearExpiryCount: 0,
        totalCostExposure: 0,
        totalRevenueExposure: 0,
        avgRisk: 0,
      };

      current.productCount += 1;
      current.totalCostExposure += product.costExposure;
      current.totalRevenueExposure += product.revenueExposure;
      current.avgRisk += product.wasteRiskScore;

      if (product.expiryDays !== null && product.expiryDays < 0) current.expiredCount += 1;
      if (product.expiryDays !== null && product.expiryDays >= 0 && product.expiryDays <= 2) current.urgentCount += 1;
      if (product.expiryDays !== null && product.expiryDays >= 0 && product.expiryDays <= 7) current.nearExpiryCount += 1;

      map.set(category, current);
    }

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        avgRisk: item.productCount ? item.avgRisk / item.productCount : 0,
      }))
      .sort((a, b) => b.avgRisk - a.avgRisk);
  }, [wasteProducts]);

  const topWasteRisk = useMemo(() => wasteProducts.slice(0, 8), [wasteProducts]);
  const maxCategoryRisk = Math.max(...categoryWaste.map((c) => c.avgRisk), 1);
  const maxProductRisk = Math.max(...topWasteRisk.map((p) => p.wasteRiskScore), 1);

  const onRefresh = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadProducts(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary2} />
          <Text style={styles.loadingText}>Loading waste and expiry analytics...</Text>
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
                  <MaterialCommunityIcons name="calendar-alert" size={24} color="#fff" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>Freshness intelligence</Text>
                  <Text style={styles.heroTitle}>Waste & Expiry</Text>
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
              Track expiry pressure, waste exposure, category spoilage risk and the products
              that need immediate markdown or removal attention.
            </Text>

            <View style={styles.heroInsightBand}>
              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Near expiry</Text>
                <Text style={styles.heroInsightValue}>{overview.nearExpiryCount}</Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Expired</Text>
                <Text style={styles.heroInsightValue}>{overview.expiredCount}</Text>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroInsightItem}>
                <Text style={styles.heroInsightLabel}>Cost exposure</Text>
                <Text style={styles.heroInsightValue}>
                  {formatCompactCurrency(overview.wasteExposureCost)}
                </Text>
              </View>
            </View>
          </LinearGradient>

          <SectionHeader
            eyebrow="Overview"
            title="Expiry landscape"
            subtitle="The highest-level view of spoilage risk and inventory waste exposure."
          />

          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Tracked"
              value={`${overview.totalTracked}`}
              subtitle="Products with inventory"
              icon="basket-outline"
              tone="green"
            />
            <SummaryCard
              title="Expired"
              value={`${overview.expiredCount}`}
              subtitle="Already beyond expiry"
              icon="close-circle-outline"
              tone="red"
            />
            <SummaryCard
              title="Urgent"
              value={`${overview.urgentCount}`}
              subtitle="0 to 2 days remaining"
              icon="alarm-outline"
              tone="yellow"
            />
            <SummaryCard
              title="Near expiry"
              value={`${overview.nearExpiryCount}`}
              subtitle="Within 7 days"
              icon="time-outline"
              tone="blue"
            />
            <SummaryCard
              title="Cost exposure"
              value={formatCompactCurrency(overview.wasteExposureCost)}
              subtitle="At-risk cost value"
              icon="wallet-outline"
              tone="purple"
            />
            <SummaryCard
              title="Revenue exposure"
              value={formatCompactCurrency(overview.wasteExposureRevenue)}
              subtitle="Sell-through potential"
              icon="cash-outline"
              tone="cyan"
            />
          </View>

          <SectionHeader
            eyebrow="Categories"
            title="Category spoilage pressure"
            subtitle="Which categories are carrying the strongest expiry and waste risk."
          />

          <View style={styles.cardBlock}>
            {categoryWaste.length > 0 ? (
              categoryWaste.slice(0, 8).map((category) => (
                <View key={category.category} style={styles.insightRowCard}>
                  <View style={styles.insightRowTop}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.insightRowTitle}>{category.category}</Text>
                      <Text style={styles.insightRowSubtitle}>
                        {category.productCount} products • {category.nearExpiryCount} within 7 days
                      </Text>
                    </View>
                    <Text style={styles.insightRowValue}>
                      Risk {category.avgRisk.toFixed(0)}%
                    </Text>
                  </View>

                  <Bar
                    value={category.avgRisk}
                    max={maxCategoryRisk}
                    color={palette.warning}
                  />

                  <View style={styles.metricRow}>
                    <Text style={styles.metricText}>Expired {category.expiredCount}</Text>
                    <Text style={styles.metricText}>Urgent {category.urgentCount}</Text>
                    <Text style={styles.metricText}>
                      Cost {formatCompactCurrency(category.totalCostExposure)}
                    </Text>
                    <Text style={styles.metricText}>
                      Revenue {formatCompactCurrency(category.totalRevenueExposure)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No expiry analytics yet</Text>
                <Text style={styles.emptySubtitle}>
                  Upload product data with expiry dates to unlock waste intelligence.
                </Text>
              </View>
            )}
          </View>

          <SectionHeader
            eyebrow="Products"
            title="Highest waste-risk products"
            subtitle="Products that need the most immediate attention."
          />

          <View style={styles.cardBlock}>
            {topWasteRisk.length > 0 ? (
              topWasteRisk.map((product) => {
                const tone = riskTone(product.wasteRiskScore);

                return (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.productCard}
                    activeOpacity={0.94}
                    onPress={() =>
                      router.push({
                        pathname: '/product-details',
                        params: { id: product.id },
                      })
                    }
                  >
                    <View style={styles.productTopRow}>
                      <View style={styles.productMainLeft}>
                        <View style={styles.productIconWrap}>
                          <MaterialCommunityIcons
                            name="food-outline"
                            size={18}
                            color={palette.primary2}
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.productTitle}>{product.name}</Text>
                          <Text style={styles.productSubtitle}>
                            {product.category || 'General'} • {product.supplier_name || 'Unknown supplier'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.riskBadge, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.riskBadgeText, { color: tone.color }]}>
                          {tone.label}
                        </Text>
                      </View>
                    </View>

                    <Bar
                      value={product.wasteRiskScore}
                      max={maxProductRisk}
                      color={palette.danger}
                    />

                    <View style={styles.productMetricsGrid}>
                      <View style={styles.metricBox}>
                        <Text style={styles.metricBoxValue}>
                          {expiryLabel(product.expiryDays)}
                        </Text>
                        <Text style={styles.metricBoxLabel}>Expiry</Text>
                      </View>

                      <View style={styles.metricBox}>
                        <Text style={styles.metricBoxValue}>
                          {safeNumber(product.stock_quantity)}
                        </Text>
                        <Text style={styles.metricBoxLabel}>Stock</Text>
                      </View>

                      <View style={styles.metricBox}>
                        <Text style={styles.metricBoxValue}>
                          {formatCompactCurrency(product.costExposure)}
                        </Text>
                        <Text style={styles.metricBoxLabel}>Cost risk</Text>
                      </View>

                      <View style={styles.metricBox}>
                        <Text style={styles.metricBoxValue}>
                          {product.wasteRiskScore}%
                        </Text>
                        <Text style={styles.metricBoxLabel}>Risk</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No risk products yet</Text>
                <Text style={styles.emptySubtitle}>
                  Once expiry-based data exists, the riskiest products will appear here.
                </Text>
              </View>
            )}
          </View>

          <SectionHeader
            eyebrow="Interpretation"
            title="What this means"
            subtitle="A quick reading of your waste and expiry exposure."
          />

          <View style={styles.summaryNarrativeCard}>
            <Text style={styles.summaryNarrativeText}>
              {overview.expiredCount > 0
                ? `You currently have ${overview.expiredCount} expired products that should be removed or reviewed immediately. `
                : 'You currently have no expired products. '}
              {overview.urgentCount > 0
                ? `${overview.urgentCount} products will expire within the next 2 days, creating short-term markdown pressure. `
                : 'No products are currently in the immediate expiry window. '}
              {overview.nearExpiryCount > 0
                ? `${overview.nearExpiryCount} items fall within the next 7 days and represent your main waste prevention opportunity. `
                : 'Your near-expiry exposure is currently low. '}
              Estimated cost exposure sits at {formatCurrency(overview.wasteExposureCost)}, while the associated sell-through revenue potential is about {formatCurrency(overview.wasteExposureRevenue)}.
            </Text>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>

        <AppSidebar
          visible={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          active="waste-expiry"
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

  productCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  productMainLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  productIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  productSubtitle: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  riskBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  productMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  metricBox: {
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
  metricBoxValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  metricBoxLabel: {
    color: palette.textMuted,
    fontSize: 11,
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